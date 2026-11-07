import { describe, it, expect } from 'vitest';
import { validateEnv, Environment } from './env.validation.js';

describe('validateEnv', () => {
  it('throws an error if DATABASE_URL is missing', () => {
    const invalidConfig = {
      JWT_SECRET: 'test-super-secret-key-1234567890123456',
    };
    expect(() => validateEnv(invalidConfig)).toThrow(/DATABASE_URL/);
  });

  it('throws an error if JWT_SECRET is missing', () => {
    const invalidConfig = {
      DATABASE_URL: 'postgresql://postgres:postgrespassword@localhost:5432/webedu?schema=public',
    };
    expect(() => validateEnv(invalidConfig)).toThrow(/JWT_SECRET/);
  });

  it('throws an error if JWT_SECRET is shorter than 32 characters (SEC-F05)', () => {
    const shortSecretConfig = {
      DATABASE_URL: 'postgresql://postgres:postgrespassword@localhost:5432/webedu?schema=public',
      JWT_SECRET: 'too-short-secret-only-31-chars!',
    };
    expect(() => validateEnv(shortSecretConfig)).toThrow(/JWT_SECRET/);
  });

  it('validates and parses a valid environment config with custom values', () => {
    const validConfig = {
      NODE_ENV: 'test',
      PORT: '3001',
      DATABASE_URL: 'postgresql://postgres:postgrespassword@localhost:5432/webedu?schema=public',
      JWT_SECRET: 'test-super-secret-key-1234567890123456',
      TZ: 'Asia/Ho_Chi_Minh',
    };

    const parsed = validateEnv(validConfig);
    expect(parsed.NODE_ENV).toBe(Environment.Test);
    expect(parsed.PORT).toBe(3001);
    expect(typeof parsed.PORT).toBe('number');
    expect(parsed.DATABASE_URL).toBe(validConfig.DATABASE_URL);
    expect(parsed.JWT_SECRET).toBe(validConfig.JWT_SECRET);
    expect(parsed.TZ).toBe('Asia/Ho_Chi_Minh');
  });

  it('uses default PORT 3001, NODE_ENV development, and default TZ if omitted', () => {
    const config = {
      DATABASE_URL: 'postgresql://postgres:postgrespassword@localhost:5432/webedu?schema=public',
      JWT_SECRET: 'test-super-secret-key-1234567890123456',
    };

    const parsed = validateEnv(config);
    expect(parsed.PORT).toBe(3001);
    expect(typeof parsed.PORT).toBe('number');
    expect(parsed.TZ).toBe('Asia/Ho_Chi_Minh');
    expect(parsed.CORS_ORIGIN).toBe('http://localhost:3000');
    expect(parsed.NODE_ENV).toBe(Environment.Development);
  });

  it('requires SMTP_HOST when NODE_ENV=production and MAIL_PROVIDER=smtp (FUNC-005)', () => {
    const prodWithoutSmtp = {
      NODE_ENV: 'production',
      DATABASE_URL: 'postgresql://postgres:postgrespassword@localhost:5432/webedu?schema=public',
      JWT_SECRET: 'test-super-secret-key-1234567890123456',
      MAIL_PROVIDER: 'smtp',
    };
    expect(() => validateEnv(prodWithoutSmtp)).toThrow(/SMTP_HOST/);

    const prodWithSmtp = validateEnv({
      ...prodWithoutSmtp,
      SMTP_HOST: 'smtp.webedu.vn',
    });
    expect(prodWithSmtp.SMTP_HOST).toBe('smtp.webedu.vn');
  });
});
