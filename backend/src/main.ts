import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module.js';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter.js';
import { AUTH_COOKIE_NAME } from './common/guards/jwt-auth.guard.js';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,
  });

  const configService = app.get(ConfigService);
  const trustProxy = configService.get<string>('TRUST_PROXY');
  if (trustProxy === '1' || trustProxy === 'true') {
    app.set('trust proxy', 1);
  }

  // Allow up to 4MB JSON payloads so <=2MB PNG/JPG base64 logos (~2.7MB JSON) succeed
  app.useBodyParser('json', { limit: '4mb' });
  app.use(cookieParser());

  const port = configService.get<number>('PORT', 3001);

  // Enable CORS safely without throwing raw 500 error before AllExceptionsFilter (P1-1)
  const corsOriginEnv = configService.get<string>('CORS_ORIGIN', 'http://localhost:3000');
  const allowedOrigins = corsOriginEnv
    .split(',')
    .map((o) => o.trim().replace(/\/+$/, ''))
    .filter(Boolean);

  app.enableCors({
    origin: (
      requestOrigin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      // Allow requests with no origin (e.g. mobile apps, server-to-server)
      if (!requestOrigin) {
        return callback(null, true);
      }
      const normalizedOrigin = requestOrigin.trim().replace(/\/+$/, '');
      if (allowedOrigins.includes(normalizedOrigin)) {
        return callback(null, true);
      }
      return callback(null, false);
    },
    credentials: true,
  });

  // Global prefix
  app.setGlobalPrefix('api/v1');

  // Global Validation Pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Global RFC 7807 Exception Filter
  app.useGlobalFilters(new AllExceptionsFilter());

  // Swagger Documentation (only available in non-production)
  const nodeEnv = configService.get<string>('NODE_ENV', 'development');
  if (nodeEnv !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('WebEdu API — Trung Tâm TD Hán Ngữ')
      .setDescription('Hệ thống Quản lý Học tập & Lớp học trực tuyến')
      .setVersion('1.0.0')
      .addCookieAuth(AUTH_COOKIE_NAME)
      .addBearerAuth()
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document);
    logger.log(`Swagger documentation available at http://localhost:${port}/api/docs`);
  }

  await app.listen(port);
  logger.log(`WebEdu Backend running on http://localhost:${port}/api/v1`);
}

await bootstrap();
