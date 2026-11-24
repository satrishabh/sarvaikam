import { Body, Controller, ForbiddenException, HttpException, Logger, Optional, Post, Req, Res, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { ProfileClient } from './profile-client.service';
import { EmailDto, SignInDto, SignUpDto } from './profile.dto';
import { RateLimiter, Rule } from './rate-limiter';

const COOKIE = 'sarvaikam.profile-session';
const NOTICE = { message: 'If this email can receive account messages, check your inbox and spam folder for the next step.' };
const digest = (value: string) => createHash('sha256').update(value).digest('base64url').slice(0, 22);
const emailOf = (body: unknown) => String((body as { email?: unknown } | undefined)?.email ?? '').trim().toLowerCase();

@Controller('session')
export class SessionController {
  private readonly log = new Logger(SessionController.name);
  constructor(
    private readonly profile: ProfileClient,
    private readonly auth: AuthService,
    @Optional() private readonly limiter: RateLimiter = new RateLimiter(),
  ) {}

  /**
   * CSRF guard plus abuse limits shared by every replica (RateLimiter). Buckets are keyed by account or session,
   * with only a generous per-IP ceiling, so many learners behind one campus/office NAT are not locked out together.
   * Keep Keycloak brute-force protection enabled as the layer behind this one.
   */
  async check(req: Request, rules: Rule[]) {
    if (req.get('X-Sarvaikam-Client') !== 'web') throw new ForbiddenException('Use the Sarvaikam sign-in form');
    if (!(await this.limiter.hit(rules))) throw new HttpException('Too many attempts. Try again in 15 minutes.', 429);
  }

  private cookieOptions() {
    return { httpOnly: true, secure: (process.env.APP_ENV ?? 'dev') !== 'dev', sameSite: 'strict' as const, path: '/api/auth/session' };
  }

  private refreshCookie(req: Request): string | null {
    const pair = req.headers.cookie?.split(';').map(x => x.trim()).find(x => x.startsWith(`${COOKIE}=`));
    if (!pair) return null;
    try { return decodeURIComponent(pair.slice(COOKIE.length + 1)) || null; }
    catch { return null; }
  }

  private accountRules(req: Request, action: string, perAccount: number, perIp: number): Rule[] {
    return [[`${action}:ip:${req.ip}`, perIp], [`${action}:acct:${req.ip}:${digest(emailOf(req.body))}`, perAccount]];
  }

  @Post('login')
  async login(@Req() req: Request, @Res({ passthrough: true }) res: Response, @Body() dto: SignInDto) {
    await this.check(req, this.accountRules(req, 'login', 10, 300));
    res.setHeader('Cache-Control', 'no-store');
    const tokens = await this.profile.login(dto.email, dto.password);
    try {
      const session = await this.auth.exchangeProfileToken(tokens.access_token);
      res.cookie(COOKIE, tokens.refresh_token, { ...this.cookieOptions(), maxAge: tokens.refresh_expires_in * 1000 });
      return session;
    } catch (error) {
      await this.profile.logout(tokens.refresh_token).catch(() => {});
      throw error;
    }
  }

  @Post('register')
  async register(@Req() req: Request, @Body() dto: SignUpDto) {
    await this.check(req, this.accountRules(req, 'register', 5, 100));
    await this.profile.register(dto);
    return NOTICE;
  }

  @Post('refresh')
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    res.setHeader('Cache-Control', 'no-store');
    const cookie = this.refreshCookie(req);
    if (req.get('X-Sarvaikam-Client') !== 'web') throw new ForbiddenException('Use the Sarvaikam sign-in form');
    // Anonymous visitors have nothing to refresh: answer without spending a rate-limit slot or a Keycloak call.
    if (!cookie) throw new UnauthorizedException();
    await this.check(req, [[`refresh:sid:${digest(cookie)}`, 60], [`refresh:ip:${req.ip}`, 3000]]);
    try {
      const tokens = await this.profile.refresh(cookie);
      const session = await this.auth.exchangeProfileToken(tokens.access_token);
      res.cookie(COOKIE, tokens.refresh_token, { ...this.cookieOptions(), maxAge: tokens.refresh_expires_in * 1000 });
      return session;
    } catch (error) {
      // A temporary Profile Manager outage must not sign everyone out; only a rejected session clears the cookie.
      if (!(error instanceof ServiceUnavailableException)) res.clearCookie(COOKIE, this.cookieOptions());
      throw error;
    }
  }

  /** Always completes for the caller: the cookie is cleared even if revoking at the Profile Manager fails. */
  @Post('logout')
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    if (req.get('X-Sarvaikam-Client') !== 'web') throw new ForbiddenException('Use the Sarvaikam sign-in form');
    res.setHeader('Cache-Control', 'no-store');
    const cookie = this.refreshCookie(req);
    res.clearCookie(COOKIE, this.cookieOptions());
    if (!cookie) return { message: 'Signed out', revoked: true };
    await this.check(req, [[`logout:sid:${digest(cookie)}`, 30]]);
    try {
      await this.profile.logout(cookie);
      return { message: 'Signed out', revoked: true };
    } catch (error) {
      // The browser no longer holds the refresh token, so the remote session cannot be resumed from here.
      this.log.warn(`Profile session revoke failed after local sign-out: ${(error as Error).message}`);
      return { message: 'Signed out', revoked: false };
    }
  }

  /** Signs this identity out on every device by ending all of its Profile Manager sessions. */
  @Post('logout-all')
  async logoutAll(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    if (req.get('X-Sarvaikam-Client') !== 'web') throw new ForbiddenException('Use the Sarvaikam sign-in form');
    res.setHeader('Cache-Control', 'no-store');
    const cookie = this.refreshCookie(req);
    if (!cookie) throw new UnauthorizedException();
    await this.check(req, [[`logout-all:sid:${digest(cookie)}`, 5]]);
    // Prove possession of a live session, and learn the identity, straight from the Profile Manager.
    const tokens = await this.profile.refresh(cookie);
    const subject = this.subjectOf(tokens.access_token);
    await this.profile.logoutEverywhere(subject);
    res.clearCookie(COOKIE, this.cookieOptions());
    return { message: 'Signed out on all devices' };
  }

  private subjectOf(accessToken: string): string {
    try {
      const payload = JSON.parse(Buffer.from(accessToken.split('.')[1], 'base64url').toString('utf8')) as { sub?: unknown };
      if (typeof payload.sub === 'string' && payload.sub) return payload.sub;
    } catch { /* fall through */ }
    throw new UnauthorizedException();
  }

  @Post('verify-email')
  async verifyEmail(@Req() req: Request, @Body() dto: EmailDto) {
    await this.check(req, this.accountRules(req, 'email', 5, 100));
    await this.profile.emailAction(dto.email, 'VERIFY_EMAIL');
    return NOTICE;
  }

  @Post('recover')
  async recover(@Req() req: Request, @Body() dto: EmailDto) {
    await this.check(req, this.accountRules(req, 'email', 5, 100));
    await this.profile.emailAction(dto.email, 'UPDATE_PASSWORD');
    return NOTICE;
  }
}
