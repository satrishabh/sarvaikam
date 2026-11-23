import { Body, Controller, Get, Headers, Param, ParseUUIDPipe, Patch, Post, Put, Query, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DataSource } from 'typeorm';
import { AuthService } from './auth.service';
import { BusinessApplicationDto, PolicyDto, ReaderPreferencesDto, ReviewDto, UserAccessDto } from './profile.dto';

@Controller()
export class AuthController {
  constructor(private readonly auth: AuthService, private readonly jwt: JwtService, private readonly db: DataSource) {}

  @Post('oidc/exchange')
  exchange(@Headers('authorization') header?: string) {
    if (!header?.startsWith('Bearer ')) throw new UnauthorizedException();
    return this.auth.exchangeProfileToken(header.slice(7));
  }

  @Get('me')
  async me(@Headers('authorization') header?: string) {
    return this.auth.me(await this.subject(header));
  }

  private async subject(header?: string): Promise<string> {
    if (!header?.startsWith('Bearer ')) throw new UnauthorizedException();
    try {
      const payload = await this.jwt.verifyAsync<{ sub: string }>(header.slice(7), { algorithms: ['HS256'] });
      if (!payload.sub) throw new UnauthorizedException();
      return payload.sub;
    } catch {
      throw new UnauthorizedException();
    }
  }

  @Post('me/business-application')
  async apply(@Headers('authorization') header: string, @Body() dto: BusinessApplicationDto) {
    return this.auth.applyForBusiness(await this.subject(header), dto);
  }

  @Put('me/reader-preferences')
  async readerPreferences(@Headers('authorization') header: string, @Body() dto: ReaderPreferencesDto) {
    return this.auth.updateReaderPreferences(await this.subject(header), dto);
  }

  @Get('admin/users')
  async users(@Headers('authorization') header: string, @Query('q') q = '', @Query('status') status = '', @Query('page') page = '1') {
    return this.auth.listUsers(await this.subject(header), q.trim(), status, Number(page));
  }

  @Post('admin/users/:id/business-review')
  async review(@Headers('authorization') header: string, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ReviewDto) {
    return this.auth.reviewBusiness(await this.subject(header), id, dto);
  }

  @Patch('admin/users/:id')
  async access(@Headers('authorization') header: string, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UserAccessDto) {
    return this.auth.updateAccess(await this.subject(header), id, dto);
  }

  @Get('admin/roles')
  async roles(@Headers('authorization') header: string) {
    return this.auth.rolePolicies(await this.subject(header));
  }

  @Put('admin/roles/:role')
  async policy(@Headers('authorization') header: string, @Param('role') role: string, @Body() dto: PolicyDto) {
    return this.auth.updatePolicy(await this.subject(header), role, dto.permissions);
  }

  @Get('admin/audit')
  async audit(@Headers('authorization') header: string) {
    return this.auth.auditLog(await this.subject(header));
  }

  /** Liveness: the process is serving. Deliberately ignores the database so a DB blip doesn't restart the pod. */
  @Get('health')
  health() {
    return { status: 'UP' };
  }

  /** Readiness: only take traffic when the database answers, so sign-ins fail over instead of erroring. */
  @Get('ready')
  async ready() {
    let timer: NodeJS.Timeout | undefined;
    try {
      await Promise.race([
        this.db.query('SELECT 1'),
        new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('timeout')), 2000); }),
      ]);
      return { status: 'UP' };
    } catch {
      throw new ServiceUnavailableException({ status: 'DOWN' });
    } finally {
      clearTimeout(timer);
    }
  }
}
