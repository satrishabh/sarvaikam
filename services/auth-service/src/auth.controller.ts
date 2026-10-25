import { Body, Controller, Get, Headers, HttpCode, Post, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { LoginDto, RegisterDto } from './dto';

@Controller()
export class AuthController {
  constructor(private readonly auth: AuthService, private readonly jwt: JwtService) {}

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }

  @Post('login')
  @HttpCode(200)
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
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
