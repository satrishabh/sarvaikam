import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import jwksClient from 'jwks-rsa';
import * as jwt from 'jsonwebtoken';
import { EntityManager, Repository } from 'typeorm';
import { isEmail } from 'class-validator';
import { AccessAudit, DEFAULT_PERMISSIONS, PERMISSIONS, Permission, RolePolicy } from './access.entity';
import { BusinessApplicationDto, ReviewDto, UserAccessDto } from './profile.dto';
import { User } from './user.entity';

export interface PublicUser {
  id: string;
  email: string;
  name: string;
  role: string;
  permissions: Permission[];
  businessStatus: string;
  organization: string;
  businessWebsite: string;
  businessReason: string;
  reviewNote: string;
  reviewedAt: Date | null;
  disabled: boolean;
  createdAt: Date;
}

type ProfileTokenClaims = jwt.JwtPayload & {
  azp?: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  preferred_username?: string;
  realm_access?: { roles?: string[] };
};

@Injectable()
export class AuthService {
  private readonly profileIssuer = (process.env.PROFILE_ISSUER ?? 'https://profile.sarvaikam.com/realms/sarvaikam').replace(/\/$/, '');
  private readonly profileClientId = process.env.PROFILE_CLIENT_ID ?? 'sarvaikam-learn';
  private readonly profileKeys = jwksClient({
    jwksUri: `${this.profileIssuer}/protocol/openid-connect/certs`,
    cache: true,
    rateLimit: true,
    timeout: 5000,
  });

  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly jwt: JwtService,
    @InjectRepository(RolePolicy) private readonly policies: Repository<RolePolicy>,
    @InjectRepository(AccessAudit) private readonly audit: Repository<AccessAudit>,
  ) {}

  async exchangeProfileToken(token: string) {
    const decoded = jwt.decode(token, { complete: true });
    if (!decoded || typeof decoded === 'string' || decoded.header.alg !== 'RS256' || !decoded.header.kid) {
      throw new UnauthorizedException('Invalid profile-manager token');
    }

    const signingKey = await new Promise<string>((resolve, reject) => {
      this.profileKeys.getSigningKey(decoded.header.kid!, (error, key) => {
        if (error) reject(error);
        else if (!key) reject(new UnauthorizedException('Profile-manager signing key was not found'));
        else resolve(key.getPublicKey());
      });
    }).catch(() => { throw new UnauthorizedException('Could not validate the profile-manager signing key'); });

    let claims: ProfileTokenClaims;
    try {
      const verified = jwt.verify(token, signingKey, {
        algorithms: ['RS256'],
        issuer: this.profileIssuer,
        clockTolerance: 5,
      });
      if (typeof verified === 'string') throw new UnauthorizedException('Invalid profile-manager token');
      claims = verified as ProfileTokenClaims;
    } catch {
      throw new UnauthorizedException('Invalid or expired profile-manager token');
    }

    if (
      ![this.profileClientId, process.env.PROFILE_API_CLIENT_ID ?? 'sarvaikam-learn-api'].includes(claims.azp ?? '') ||
      typeof claims.sub !== 'string' ||
      !claims.sub ||
      typeof claims.email !== 'string' ||
      claims.email_verified !== true ||
      !isEmail(claims.email.trim()) || claims.email.length > 254 ||
      typeof claims.exp !== 'number'
    ) {
      throw new UnauthorizedException('A verified email and valid Learn client session are required');
    }

    const email = claims.email.trim().toLowerCase();
    const roles = Array.isArray(claims.realm_access?.roles) ? claims.realm_access.roles : [];
    let user = await this.users.findOneBy({ oidcSub: claims.sub });
    try {
      if (!user) {
        if (await this.users.existsBy({ email })) {
          throw new ConflictException('This email is already linked to a local account. Contact support to migrate it.');
        }
        user = this.users.create({
          oidcSub: claims.sub,
          email,
          name: this.profileName(claims, email),
          role: roles.includes('content-admin') ? 'ADMIN' : 'USER',
          passwordHash: await bcrypt.hash(randomBytes(32).toString('hex'), 12),
        });
        user = await this.users.save(user);
      } else {
        if (user.disabled) throw new ForbiddenException('Your account is suspended. Contact an administrator.');
        // Update identity fields only. Saving a stale full entity could undo a concurrent approval or suspension.
        await this.users.update({ id: user.id }, { email, name: this.profileName(claims, email) });
        user = await this.users.findOneBy({ id: user.id });
        if (!user) throw new UnauthorizedException();
      }

      if (user.disabled) throw new ForbiddenException('Your account is suspended. Contact an administrator.');
      return await this.issue(user);
    } catch (error) {
      if ((error as { code?: string }).code === '23505') throw new ConflictException('This identity or email is already linked to another account');
      throw error;
    }
  }

  async me(id: string): Promise<PublicUser> {
    const user = await this.users.findOneBy({ id });
    if (!user || user.disabled) throw new UnauthorizedException('This account is unavailable');
    return this.toPublic(user);
  }

  private async issue(user: User) {
    const token = await this.jwt.signAsync({ sub: user.id, email: user.email, role: user.role });
    return { token, user: await this.toPublic(user) };
  }

  private async toPublic(u: User): Promise<PublicUser> {
    const policy = await this.policies.findOneBy({ role: u.role });
    const permissions = u.role === 'ADMIN' ? [...PERMISSIONS] : (policy?.permissions ?? DEFAULT_PERMISSIONS[u.role] ?? []);
    return { id: u.id, email: u.email, name: u.name, role: u.role, permissions,
      businessStatus: u.businessStatus, organization: u.organization, businessWebsite: u.businessWebsite,
      businessReason: u.businessReason, reviewNote: u.reviewNote, reviewedAt: u.reviewedAt,
      disabled: u.disabled, createdAt: u.createdAt };
  }

  private profileName(claims: ProfileTokenClaims, fallback: string) {
    const value = typeof claims.name === 'string' ? claims.name : typeof claims.preferred_username === 'string' ? claims.preferred_username : fallback;
    return value.trim().replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 80) || fallback;
  }

  async requireAdmin(id: string) {
    const user = await this.me(id);
    if (user.role !== 'ADMIN') throw new ForbiddenException('Administrator access is required');
  }

  private async lockedAdmin(manager: EntityManager, id: string) {
    await manager.query('SELECT pg_advisory_xact_lock(749203)');
    const admin = await manager.findOneBy(User, { id });
    if (!admin || admin.disabled || admin.role !== 'ADMIN') throw new ForbiddenException('Administrator access is required');
  }

  async applyForBusiness(id: string, dto: BusinessApplicationDto) {
    return this.users.manager.transaction(async manager => {
      const user = await manager.findOne(User, { where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!user || user.disabled) throw new UnauthorizedException();
      if (user.role !== 'USER' || user.businessStatus === 'PENDING') throw new ConflictException('Your account already has business access or a pending application');
      Object.assign(user, { organization: dto.organization, businessWebsite: dto.website, businessReason: dto.reason,
        businessStatus: 'PENDING', reviewNote: '', reviewedBy: null, reviewedAt: null });
      await manager.save(user);
      await manager.save(AccessAudit, { actor: id, action: 'business.applied', target: id, details: {} });
      return this.toPublic(user);
    });
  }

  async listUsers(actor: string, query: string, status: string, page: number) {
    const viewer = await this.me(actor);
    if (!viewer.permissions.includes('candidates.view')) throw new ForbiddenException('Candidate access is required');
    if (query.length > 200 || !Number.isInteger(page) || page < 1 || page > 100000) throw new BadRequestException('Invalid search or page');
    if (status && !['NONE', 'PENDING', 'APPROVED', 'REJECTED'].includes(status)) throw new BadRequestException('Invalid application status');
    const qb = this.users.createQueryBuilder('u');
    if (query) qb.andWhere('(u.email ILIKE :q OR u.name ILIKE :q OR u.organization ILIKE :q)', { q: `%${query}%` });
    if (status) qb.andWhere('u.businessStatus = :status', { status });
    const [users, total] = await qb.orderBy('u.createdAt', 'DESC').skip((page - 1) * 25).take(25).getManyAndCount();
    return { items: await Promise.all(users.map(u => this.toPublic(u))), total, page, pageSize: 25 };
  }

  async reviewBusiness(actor: string, id: string, dto: ReviewDto) {
    await this.requireAdmin(actor);
    return this.users.manager.transaction(async manager => {
      await this.lockedAdmin(manager, actor);
      const user = await manager.findOne(User, { where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!user) throw new NotFoundException('User not found');
      if (user.businessStatus !== 'PENDING' || user.role !== 'USER' || user.disabled) throw new ConflictException('Only an active, pending business application can be reviewed');
      if (actor === id) throw new ForbiddenException('You cannot review your own application');
      Object.assign(user, { businessStatus: dto.decision, role: dto.decision === 'APPROVED' ? 'BUSINESS' : 'USER',
        reviewNote: dto.note, reviewedBy: actor, reviewedAt: new Date() });
      await manager.save(user);
      await manager.save(AccessAudit, { actor, action: 'business.reviewed', target: id, details: { ...dto } });
      return this.toPublic(user);
    });
  }

  async updateAccess(actor: string, id: string, dto: UserAccessDto) {
    await this.requireAdmin(actor);
    if (dto.role === undefined && dto.disabled === undefined) throw new BadRequestException('Choose a role or account status');
    return this.users.manager.transaction(async manager => {
      // Serialize admin changes, including concurrent attempts to remove the last administrator.
      await this.lockedAdmin(manager, actor);
      const user = await manager.findOneBy(User, { id });
      if (!user) throw new NotFoundException('User not found');
      if (actor === id && (dto.disabled === true || (dto.role && dto.role !== 'ADMIN'))) throw new ConflictException('Ask another administrator to change your own admin access');
      if (dto.role === 'BUSINESS' && user.businessStatus !== 'APPROVED') throw new ConflictException('Approve a business application before granting business access');
      if (user.role === 'ADMIN' && !user.disabled && (dto.disabled === true || (dto.role && dto.role !== 'ADMIN'))) {
        if (await manager.countBy(User, { role: 'ADMIN', disabled: false }) <= 1) throw new ConflictException('Keep at least one active administrator');
      }
      const before = { role: user.role, disabled: user.disabled };
      Object.assign(user, dto);
      await manager.save(user);
      await manager.save(AccessAudit, { actor, action: 'access.changed', target: id, details: { before, after: dto } });
      return this.toPublic(user);
    });
  }

  async rolePolicies(actor: string) {
    await this.requireAdmin(actor);
    const stored = await this.policies.find();
    return ['ADMIN', 'BUSINESS', 'USER'].map(role => ({ role,
      permissions: role === 'ADMIN' ? [...PERMISSIONS] : stored.find(p => p.role === role)?.permissions ?? DEFAULT_PERMISSIONS[role] }));
  }

  async updatePolicy(actor: string, role: string, permissions: Permission[]) {
    await this.requireAdmin(actor);
    if (!['USER', 'BUSINESS'].includes(role)) throw new BadRequestException('Admin access is fixed; choose USER or BUSINESS');
    return this.policies.manager.transaction(async manager => {
      await this.lockedAdmin(manager, actor);
      await manager.save(RolePolicy, { role, permissions });
      await manager.save(AccessAudit, { actor, action: 'policy.changed', target: role, details: { permissions } });
      return { role, permissions };
    });
  }

  async auditLog(actor: string) {
    await this.requireAdmin(actor);
    return this.audit.find({ order: { createdAt: 'DESC' }, take: 100 });
  }
}
