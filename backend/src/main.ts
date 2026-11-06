import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module.js';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter.js';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT', 3001);

  // Enable CORS safely
  const corsOriginEnv = configService.get<string>('CORS_ORIGIN', 'http://localhost:3000');
  const allowedOrigins = corsOriginEnv.split(',').map((o) => o.trim());

  app.enableCors({
    origin: (
      requestOrigin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      // Allow requests with no origin (e.g. mobile apps, server-to-server)
      if (!requestOrigin) {
        return callback(null, true);
      }
      if (
        allowedOrigins.includes(requestOrigin) ||
        (process.env.NODE_ENV !== 'production' &&
          /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(requestOrigin))
      ) {
        return callback(null, true);
      }
      return callback(new Error(`Origin ${requestOrigin} not allowed by CORS`));
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
