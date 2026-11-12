import { ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import express, { type NextFunction, type Request, type Response } from 'express';
import helmet from 'helmet';
import { AllExceptionsFilter } from '../filters/all-exceptions.filter.js';

export const DEFAULT_JSON_BODY_LIMIT = '100kb';
export const LOGO_UPLOAD_JSON_BODY_LIMIT = '4mb';
const LOGO_UPLOAD_PATH = '/api/v1/system-settings/config';

export interface ConfigureAppOptions {
  nodeEnv: string;
  allowedOrigins: readonly string[];
}

export function configureAppSecurityAndPipes(
  app: NestExpressApplication,
  options: ConfigureAppOptions,
): void {
  const { nodeEnv, allowedOrigins } = options;

  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      // Keep Swagger UI functional outside production while enforcing full CSP in production.
      contentSecurityPolicy: nodeEnv === 'production' ? undefined : false,
    }),
  );

  const standardJsonParser = express.json({ limit: DEFAULT_JSON_BODY_LIMIT });
  const logoUploadJsonParser = express.json({ limit: LOGO_UPLOAD_JSON_BODY_LIMIT });
  app.use((req: Request, res: Response, next: NextFunction) => {
    const normalizedPath = req.path.replace(/\/+$/, '') || '/';
    if (req.method.toUpperCase() === 'PUT' && normalizedPath === LOGO_UPLOAD_PATH) {
      return logoUploadJsonParser(req, res, next);
    }
    return standardJsonParser(req, res, next);
  });

  app.use(cookieParser());

  app.enableCors({
    origin: (
      requestOrigin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
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

  app.setGlobalPrefix('api/v1');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.useGlobalFilters(new AllExceptionsFilter());
}
