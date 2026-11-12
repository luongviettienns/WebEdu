import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { AuthRegistrationService } from '../../src/modules/auth/services/auth-registration.service.js';
import type { RegisterDto } from '../../src/modules/auth/dto/auth.dto.js';
import type { LocalSmtpTestServer } from './local-smtp-server.js';

export async function obtainVerificationCodeViaHttp(
  app: INestApplication,
  smtpServer: LocalSmtpTestServer,
  email: string,
): Promise<string> {
  await request(app.getHttpServer())
    .post('/api/v1/auth/send-verification-code')
    .set('Origin', 'http://localhost:3000')
    .send({ email })
    .expect(200);

  const normalizedEmail = email.trim().toLowerCase();
  const msg = smtpServer.getLatestMessageFor(normalizedEmail);
  if (!msg) {
    throw new Error(`No verification email captured for ${normalizedEmail}`);
  }
  const code = smtpServer.extractVerificationCodeFromMessage(msg);
  if (!code) {
    throw new Error(`Could not parse 6-digit OTP from email for ${normalizedEmail}`);
  }
  return code;
}

export async function registerStudentViaHttpWithOtp(
  app: INestApplication,
  smtpServer: LocalSmtpTestServer,
  payload: Omit<RegisterDto, 'verificationCode'>,
  endpoint: '/api/v1/auth/register' | '/api/v1/auth/register/student' = '/api/v1/auth/register',
) {
  const verificationCode = await obtainVerificationCodeViaHttp(
    app,
    smtpServer,
    payload.email,
  );
  return request(app.getHttpServer())
    .post(endpoint)
    .send({
      ...payload,
      verificationCode,
    });
}

export async function obtainVerificationCodeViaService(
  registrationService: Pick<AuthRegistrationService, 'sendVerificationCode'>,
  smtpServer: LocalSmtpTestServer,
  email: string,
): Promise<string> {
  await registrationService.sendVerificationCode(email);
  const normalizedEmail = email.trim().toLowerCase();
  const msg = smtpServer.getLatestMessageFor(normalizedEmail);
  if (!msg) {
    throw new Error(`No verification email captured for ${normalizedEmail}`);
  }
  const code = smtpServer.extractVerificationCodeFromMessage(msg);
  if (!code) {
    throw new Error(`Could not parse 6-digit OTP from email for ${normalizedEmail}`);
  }
  return code;
}

export async function registerStudentViaServiceWithOtp(
  registrationService: Pick<
    AuthRegistrationService,
    'sendVerificationCode' | 'register'
  >,
  smtpServer: LocalSmtpTestServer,
  payload: Omit<RegisterDto, 'verificationCode'>,
  metadata?: { ipAddress?: string; userAgent?: string },
) {
  const verificationCode = await obtainVerificationCodeViaService(
    registrationService,
    smtpServer,
    payload.email,
  );
  return registrationService.register(
    {
      ...payload,
      verificationCode,
    },
    metadata,
  );
}
