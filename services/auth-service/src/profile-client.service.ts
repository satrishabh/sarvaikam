import { BadRequestException, Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { SignUpDto } from './profile.dto';

interface ProfileTokens { access_token: string; refresh_token: string; expires_in: number; refresh_expires_in: number }

/** All credentials stay server-side; the shared Profile Manager remains the credential store. */
@Injectable()
export class ProfileClient {
  private readonly issuer = (process.env.PROFILE_ISSUER ?? 'https://profile.sarvaikam.com/realms/sarvaikam').replace(/\/$/, '');
  private readonly clientId = process.env.PROFILE_API_CLIENT_ID ?? 'sarvaikam-learn-api';
  private readonly adminId = process.env.PROFILE_REGISTRATION_CLIENT_ID ?? 'sarvaikam-learn-registration';
  private readonly adminUrl = `${this.issuer.split('/realms/')[0]}/admin/realms/${encodeURIComponent(this.issuer.split('/realms/')[1])}`;

  private async fetch(path: string, init: RequestInit) {
    try { return await fetch(path, { ...init, signal: AbortSignal.timeout(10_000), redirect: 'error' }); }
    catch { throw new ServiceUnavailableException('Secure sign-in is temporarily unavailable. Try again shortly.'); }
  }

  private secret(name: string) {
    const value = process.env[name];
    if (!value) throw new ServiceUnavailableException('Secure sign-in is not configured yet');
    return value;
  }

  private async token(values: Record<string, string>): Promise<ProfileTokens> {
    const res = await this.fetch(`${this.issuer}/protocol/openid-connect/token`, { method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: this.clientId, client_secret: this.secret('PROFILE_API_CLIENT_SECRET'), ...values }) });
    if (!res.ok) {
      if (res.status >= 500 || res.status === 401) throw new ServiceUnavailableException('Secure sign-in is temporarily unavailable or needs configuration');
      throw new UnauthorizedException('Check your email and password, and verify your email before signing in.');
    }
    return res.json() as Promise<ProfileTokens>;
  }

  login(email: string, password: string) { return this.token({ grant_type: 'password', username: email, password, scope: 'openid email profile' }); }
  refresh(refreshToken: string) { return this.token({ grant_type: 'refresh_token', refresh_token: refreshToken }); }

  async logout(refreshToken: string) {
    const res = await this.fetch(`${this.issuer}/protocol/openid-connect/logout`, { method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({
        client_id: this.clientId, client_secret: this.secret('PROFILE_API_CLIENT_SECRET'), refresh_token: refreshToken }) });
    if (!res.ok && res.status !== 400) throw new ServiceUnavailableException('The profile session could not be closed. Try signing out again.');
  }

  private async adminToken(): Promise<string> {
    const res = await this.fetch(`${this.issuer}/protocol/openid-connect/token`, { method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({
        grant_type: 'client_credentials', client_id: this.adminId,
        client_secret: this.secret('PROFILE_REGISTRATION_CLIENT_SECRET') }) });
    if (!res.ok) throw new ServiceUnavailableException('Account registration is temporarily unavailable');
    const body = await res.json() as { access_token: string };
    return body.access_token;
  }

  async register(dto: SignUpDto) {
    if (dto.password.toLowerCase().includes(dto.email.toLowerCase())) throw new BadRequestException('Your password must not contain your email address');
    const token = await this.adminToken();
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
    const parts = dto.name.split(/\s+/);
    const res = await this.fetch(`${this.adminUrl}/users`, { method: 'POST', headers, body: JSON.stringify({
      username: dto.email, email: dto.email, firstName: parts[0], lastName: parts.slice(1).join(' '),
      enabled: true, emailVerified: false, requiredActions: ['VERIFY_EMAIL'],
      credentials: [{ type: 'password', value: dto.password, temporary: false }],
    }) });
    // Do not disclose whether a given email is registered.
    if (res.status === 409) return;
    if (!res.ok) {
      if (res.status === 400) throw new BadRequestException('Use a valid name, email, and a password of 12–128 characters that does not contain your email');
      throw new ServiceUnavailableException('Account registration is temporarily unavailable');
    }
    const location = res.headers.get('location');
    const id = location?.split('/').pop();
    if (!id || !/^[a-f0-9-]{36}$/i.test(id)) throw new ServiceUnavailableException('Account created. Request a verification email to continue.');
    await this.sendAction(token, id, ['VERIFY_EMAIL']);
  }

  private async sendAction(token: string, id: string, actions: string[]) {
    const res = await this.fetch(`${this.adminUrl}/users/${encodeURIComponent(id)}/execute-actions-email?lifespan=1800`, {
      method: 'PUT', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(actions) });
    if (!res.ok) throw new ServiceUnavailableException('We could not send the email. Try requesting another email shortly.');
  }

  async emailAction(email: string, action: 'VERIFY_EMAIL' | 'UPDATE_PASSWORD') {
    const token = await this.adminToken();
    const res = await this.fetch(`${this.adminUrl}/users?email=${encodeURIComponent(email)}&exact=true`, {
      headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new ServiceUnavailableException('Email delivery is temporarily unavailable');
    const users = await res.json() as { id: string; enabled: boolean; emailVerified: boolean }[];
    const user = users[0];
    if (user?.enabled && (action !== 'VERIFY_EMAIL' || !user.emailVerified)) await this.sendAction(token, user.id, [action]);
  }
}
