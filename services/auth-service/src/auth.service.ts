import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import jwksClient from 'jwks-rsa';
import * as jwt from 'jsonwebtoken';
import { Repository } from 'typeorm';
import { User } from './user.entity';

export interface PublicUser {
  id: string;
  email: string;
  name: string;
  role: string;
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
    });

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
      claims.azp !== this.profileClientId ||
      typeof claims.sub !== 'string' ||
      !claims.sub ||
      typeof claims.email !== 'string' ||
      !claims.email_verified ||
      typeof claims.exp !== 'number'
    ) {
      throw new UnauthorizedException('A verified email and valid Learn client session are required');
    }

    const email = claims.email.toLowerCase();
    const roles = claims.realm_access?.roles ?? [];
    let user = await this.users.findOneBy({ oidcSub: claims.sub });
    if (!user) {
      if (await this.users.existsBy({ email })) {
        throw new ConflictException('This email is already linked to a local account. Contact support to migrate it.');
      }
      user = this.users.create({
        oidcSub: claims.sub,
        email,
        name: claims.name?.trim() || claims.preferred_username || email,
        role: roles.includes('content-admin') ? 'ADMIN' : 'USER',
        passwordHash: await bcrypt.hash(randomBytes(32).toString('hex'), 12),
      });
    } else {
      user.email = email;
      user.name = claims.name?.trim() || claims.preferred_username || email;
      user.role = roles.includes('content-admin') ? 'ADMIN' : 'USER';
    }

    return this.issue(await this.users.save(user));
  }

  async me(id: string): Promise<PublicUser> {
    const user = await this.users.findOneBy({ id });
    if (!user) throw new UnauthorizedException();
    return this.toPublic(user);
  }

  private async issue(user: User) {
    const token = await this.jwt.signAsync({ sub: user.id, email: user.email, role: user.role });
    return { token, user: this.toPublic(user) };
  }

  private toPublic(u: User): PublicUser {
    return { id: u.id, email: u.email, name: u.name, role: u.role };
  }
}
