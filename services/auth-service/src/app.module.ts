import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { User } from './user.entity';
import { AccessAudit, RolePolicy } from './access.entity';
import { ProfileClient } from './profile-client.service';
import { SessionController } from './session.controller';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST ?? 'localhost',
      port: Number(process.env.DB_PORT ?? 5432),
      database: process.env.DB_NAME ?? 'sarvaikam',
      username: process.env.DB_USER ?? 'sarvaikam',
      password: process.env.DB_PASSWORD ?? 'sarvaikam',
      // Managed Postgres in staging/prod requires TLS; the entrypoint maps DB_SSLMODE to these flags.
      ssl: process.env.DB_SSL === 'true'
        ? { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED === 'true' }
        : false,
      entities: [User, RolePolicy, AccessAudit],
      // Only this service owns the users table. Sync creates it on first start; set DB_SYNCHRONIZE=false
      // once the schema exists if you want schema changes to be applied manually.
      synchronize: process.env.DB_SYNCHRONIZE !== 'false',
      extra: { max: Number(process.env.DB_POOL_SIZE ?? 5) },
    }),
    TypeOrmModule.forFeature([User, RolePolicy, AccessAudit]),
    JwtModule.registerAsync({
      global: true,
      // Fail at startup rather than sign tokens with a known fallback secret.
      useFactory: () => {
        const secret = process.env.JWT_SECRET;
        if (!secret || secret.length < 32) throw new Error('JWT_SECRET must be set to at least 32 characters');
        // Shorter sessions outside dev.
        return { secret, signOptions: { expiresIn: '5m', algorithm: 'HS256' } };
      },
    }),
  ],
  controllers: [AuthController, SessionController],
  providers: [AuthService, ProfileClient],
})
export class AppModule {}
