import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module.js';
import { AUTH_COOKIE_NAME } from './common/auth/token.service.js';
import { configureAppSecurityAndPipes } from './common/http/configure-app.util.js';

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

  const port = configService.get<number>('PORT', 3001);
  const nodeEnv = configService.get<string>('NODE_ENV', 'development');
  const corsOriginEnv = configService.get<string>('CORS_ORIGIN');
  if (nodeEnv === 'production' && !corsOriginEnv) {
    throw new Error(
      'CORS_ORIGIN must be explicitly configured in production environment',
    );
  }

  const effectiveCors = corsOriginEnv || 'http://localhost:3000';
  const allowedOrigins = effectiveCors
    .split(',')
    .map((o) => o.trim().replace(/\/+$/, ''))
    .filter(Boolean);

  configureAppSecurityAndPipes(app, { nodeEnv, allowedOrigins });

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
