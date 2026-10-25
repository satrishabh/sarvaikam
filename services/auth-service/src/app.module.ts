import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { User } from './user.entity';

const appEnv = process.env.APP_ENV ?? 'dev';

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
      entities: [User],
      // Only this service owns the users table. Sync creates it on first start; set DB_SYNCHRONIZE=false
      // once the schema exists if you want schema changes to be applied manually.
      synchronize: process.env.DB_SYNCHRONIZE !== 'false',
      extra: { max: Number(process.env.DB_POOL_SIZE ?? 5) },
    }),
    TypeOrmModule.forFeature([User]),
    JwtModule.register({
      global: true,
      secret: process.env.JWT_SECRET ?? 'change-me-to-a-long-random-secret-of-32-bytes-min',
      // Shorter sessions outside dev.
      signOptions: { expiresIn: appEnv === 'dev' ? '12h' : '4h', algorithm: 'HS256' },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService],
})
export class AppModule {}
