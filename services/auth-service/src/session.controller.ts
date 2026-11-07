import { Body, Controller, ForbiddenException, HttpException, Post, Req, Res, UnauthorizedException } from '@nestjs/common';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { ProfileClient } from './profile-client.service';
import { EmailDto, SignInDto, SignUpDto } from './profile.dto';

const COOKIE = 'sarvaikam.profile-session';
const NOTICE = { message: 'If this email can receive account messages, check your inbox and spam folder for the next step.' };

@Controller('session')
export class SessionController {
  private readonly attempts = new Map<string, { count: number; until: number }>();
  constructor(private readonly profile: ProfileClient, private readonly auth: AuthService) {}

  private check(req: Request, limit = 12) {
    if (req.get('X-Sarvaikam-Client') !== 'web') throw new ForbiddenException('Use the Sarvaikam sign-in form');
    // Bounded per-instance abuse protection; also enable shared ingress limits and Keycloak brute-force protection.
    const now = Date.now();
    for (const [key, item] of this.attempts) if (item.until < now) this.attempts.delete(key);
    const key = `${req.ip}:${req.path}`;
    const item = this.attempts.get(key) ?? { count: 0, until: now + 15 * 60_000 };
    if (item.count >= limit || this.attempts.size > 10_000) throw new HttpException('Too many attempts. Try again in 15 minutes.', 429);
    item.count++;
    this.attempts.set(key, item);
  }

  private cookieOptions() {
    return { httpOnly: true, secure: (process.env.APP_ENV ?? 'dev') !== 'dev', sameSite: 'strict' as const, path: '/api/auth/session' };
  }

  private refreshCookie(req: Request) {
    const pair = req.headers.cookie?.split(';').map(x => x.trim()).find(x => x.startsWith(`${COOKIE}=`));
    if (!pair) throw new UnauthorizedException();
    try { return decodeURIComponent(pair.slice(COOKIE.length + 1)); }
    catch { throw new UnauthorizedException(); }
  }

  @Post('login')
  async login(@Req() req: Request, @Res({ passthrough: true }) res: Response, @Body() dto: SignInDto) {
    this.check(req);
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
    this.check(req, 5);
    await this.profile.register(dto);
    return NOTICE;
  }

  @Post('refresh')
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    this.check(req, 150);
    res.setHeader('Cache-Control', 'no-store');
    try {
      const tokens = await this.profile.refresh(this.refreshCookie(req));
      const session = await this.auth.exchangeProfileToken(tokens.access_token);
      res.cookie(COOKIE, tokens.refresh_token, { ...this.cookieOptions(), maxAge: tokens.refresh_expires_in * 1000 });
      return session;
    } catch (error) {
      res.clearCookie(COOKIE, this.cookieOptions());
      throw error;
    }
  }

  @Post('logout')
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    this.check(req, 60);
    const cookie = req.headers.cookie?.includes(`${COOKIE}=`);
    try { if (cookie) await this.profile.logout(this.refreshCookie(req)); }
    finally { res.clearCookie(COOKIE, this.cookieOptions()); }
    return { message: 'Signed out' };
  }

  @Post('verify-email')
  async verifyEmail(@Req() req: Request, @Body() dto: EmailDto) {
    this.check(req, 5);
    await this.profile.emailAction(dto.email, 'VERIFY_EMAIL');
    return NOTICE;
  }

  @Post('recover')
  async recover(@Req() req: Request, @Body() dto: EmailDto) {
    this.check(req, 5);
    await this.profile.emailAction(dto.email, 'UPDATE_PASSWORD');
    return NOTICE;
  }
}
