import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { User } from './user.entity';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST ?? 'localhost',
      port: Number(process.env.DB_PORT ?? 5432),
      database: process.env.DB_NAME ?? 'sarvaikam',
      username: process.env.DB_USER ?? 'sarvaikam',
      password: process.env.DB_PASSWORD ?? 'sarvaikam',
      entities: [User],
      // Only this service owns the users table; sync keeps the demo setup migration-free.
      synchronize: true,
    }),
    TypeOrmModule.forFeature([User]),
    JwtModule.register({
      global: true,
      secret: process.env.JWT_SECRET ?? 'change-me-to-a-long-random-secret-of-32-bytes-min',
      signOptions: { expiresIn: '12h', algorithm: 'HS256' },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService],
})
export class AppModule {}
