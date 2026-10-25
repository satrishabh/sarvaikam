import 'reflect-metadata';
import { LogLevel, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';

const LEVELS: Record<string, LogLevel[]> = {
  debug: ['error', 'warn', 'log', 'debug'],
  info: ['error', 'warn', 'log'],
  warn: ['error', 'warn'],
  error: ['error'],
};

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: LEVELS[process.env.LOG_LEVEL ?? 'info'] ?? LEVELS.info,
  });
  // Behind nginx + the ingress: use X-Forwarded-For for the client IP.
  app.set('trust proxy', 'loopback, uniquelocal');
  app.setGlobalPrefix('api/auth');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }));
  app.enableShutdownHooks();
  await app.listen(Number(process.env.PORT ?? 8082));
}
bootstrap();
