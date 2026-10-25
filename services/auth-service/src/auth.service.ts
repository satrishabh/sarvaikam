import { ConflictException, Injectable, OnModuleInit, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { Repository } from 'typeorm';
import { LoginDto, RegisterDto } from './dto';
import { User } from './user.entity';

export interface PublicUser {
  id: string;
  email: string;
  name: string;
  role: string;
}

@Injectable()
export class AuthService implements OnModuleInit {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly jwt: JwtService,
  ) {}

  /** Bootstraps an admin account from env so the CMS is usable on first run. */
  async onModuleInit() {
    const email = process.env.ADMIN_EMAIL?.toLowerCase();
    const password = process.env.ADMIN_PASSWORD;
    if (!email || !password || (await this.users.existsBy({ email }))) return;
    await this.users.save(
      this.users.create({ email, name: 'Admin', role: 'ADMIN', passwordHash: await bcrypt.hash(password, 12) }),
    );
  }

  async register(dto: RegisterDto) {
    const email = dto.email.toLowerCase();
    if (await this.users.existsBy({ email })) throw new ConflictException('Email already registered');
    const user = await this.users.save(
      this.users.create({ email, name: dto.name, role: 'USER', passwordHash: await bcrypt.hash(dto.password, 12) }),
    );
    return this.issue(user);
  }

  async login(dto: LoginDto) {
    const user = await this.users.findOneBy({ email: dto.email.toLowerCase() });
    if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid email or password');
    }
    return this.issue(user);
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
