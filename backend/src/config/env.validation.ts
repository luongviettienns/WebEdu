import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MinLength,
  ValidateIf,
  validateSync,
} from 'class-validator';

export enum Environment {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

export class EnvironmentVariables {
  @IsEnum(Environment)
  @IsOptional()
  NODE_ENV: Environment = Environment.Development;

  @IsNumber()
  @IsOptional()
  PORT: number = 3001;

  @IsString()
  DATABASE_URL!: string;

  @IsString()
  @MinLength(32)
  JWT_SECRET!: string;

  @IsString()
  @IsOptional()
  TZ: string = 'Asia/Ho_Chi_Minh';

  @ValidateIf((o: EnvironmentVariables) => o.NODE_ENV === Environment.Production)
  @IsNotEmpty({
    message: 'CORS_ORIGIN must be explicitly configured in production',
  })
  @IsString()
  CORS_ORIGIN?: string;

  @IsString()
  @IsOptional()
  FRONTEND_APP_URL?: string;

  @IsString()
  @IsOptional()
  MAIL_PROVIDER: string = 'smtp';

  @ValidateIf(
    (o: EnvironmentVariables) =>
      o.NODE_ENV === Environment.Production && o.MAIL_PROVIDER === 'smtp',
  )
  @IsString()
  @IsNotEmpty()
  SMTP_HOST?: string;

  @IsNumber()
  @IsOptional()
  SMTP_PORT?: number;

  @IsString()
  @IsOptional()
  SMTP_SECURE?: string;

  @IsString()
  @IsOptional()
  SMTP_USER?: string;

  @IsString()
  @IsOptional()
  SMTP_PASS?: string;

  @IsString()
  @IsOptional()
  SMTP_FROM?: string;
}

export function validateEnv(config: Record<string, unknown>): EnvironmentVariables {
  const effectiveConfig =
    config.NODE_ENV !== Environment.Production && !config.CORS_ORIGIN
      ? { ...config, CORS_ORIGIN: 'http://localhost:3000' }
      : config;

  const validatedConfig = plainToInstance(EnvironmentVariables, effectiveConfig, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    throw new Error(`Environment validation failed:\n${errors.toString()}`);
  }
  return validatedConfig;
}
