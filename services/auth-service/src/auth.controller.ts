import { Controller, Get, Headers, Post, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';

@Controller()
export class AuthController {
  constructor(private readonly auth: AuthService, private readonly jwt: JwtService) {}

  @Post('oidc/exchange')
  exchange(@Headers('authorization') header?: string) {
    if (!header?.startsWith('Bearer ')) throw new UnauthorizedException();
    return this.auth.exchangeProfileToken(header.slice(7));
  }

  @Get('me')
  async me(@Headers('authorization') header?: string) {
    if (!header?.startsWith('Bearer ')) throw new UnauthorizedException();
    try {
      const payload = await this.jwt.verifyAsync<{ sub: string }>(header.slice(7));
      return this.auth.me(payload.sub);
    } catch {
      throw new UnauthorizedException();
    }
  }

  @Get('health')
  health() {
    return { status: 'UP' };
  }
}
