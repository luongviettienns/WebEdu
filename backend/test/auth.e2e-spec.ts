import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/common/prisma/prisma.service.js';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter.js';
import { InMemoryPrismaService } from './helpers/in-memory-prisma.js';

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL ??= 'postgresql://postgres:postgres@localhost:5432/webedu_e2e';
process.env.JWT_SECRET ??= 'webedu-e2e-jwt-secret-key-at-least-32-chars';
process.env.CORS_ORIGIN ??= 'http://localhost:3000';

interface ProblemBody {
  type: string;
  title: string;
  status: number;
  detail: string;
}

interface RegisterSuccessBody {
  message: string;
  user: {
    id: string;
    email: string;
    phone: string;
    status: string;
    dateOfBirth?: string;
  };
}

interface LoginSuccessBody {
  accessToken: string;
  expiresIn: number;
  redirectTo: string;
  user: {
    id: string;
    email: string;
    effectiveRole: string;
  };
}

interface ForgotPasswordBody {
  message: string;
  cooldownSeconds: number;
  debugResetToken?: string;
}

describe('Authentication Flows (e2e — Slice 2.2 FUNC-001..005)', () => {
  let app: INestApplication<App>;
  let fakePrisma: InMemoryPrismaService;

  beforeEach(async () => {
    fakePrisma = new InMemoryPrismaService();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(fakePrisma)
      .compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('rejects student registration when age < 12 with 400 ProblemDetails (FUNC-001)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/register/student')
      .send({
        fullName: 'Học Viên Nhỏ Tuổi',
        dateOfBirth: '2018-05-01',
        phone: '0901110001',
        email: 'under12@example.com',
        password: 'Password@123',
      })
      .expect(400);

    expect(res.headers['content-type']).toMatch(/application\/problem\+json/);
    const body = res.body as ProblemBody;
    expect(body.status).toBe(400);
    expect(body.detail).toBe('Học viên phải từ 12 tuổi trở lên');

    // Rejects password > 72 chars via DTO @MaxLength(72) (SEC-F08)
    await request(app.getHttpServer())
      .post('/api/v1/auth/register/student')
      .send({
        fullName: 'Học Viên Mật Khẩu Quá Dài',
        dateOfBirth: '2000-05-01',
        phone: '0901110099',
        email: 'over72@example.com',
        password: 'P'.repeat(73),
      })
      .expect(400);
  });

  it('requires guardianEmail & guardianConsent for student aged 12-15 and allows two siblings to share parent guardianEmail (FUNC-002, DEC-023)', async () => {
    // Missing guardian consent -> 400
    const missingConsentRes = await request(app.getHttpServer())
      .post('/api/v1/auth/register/student')
      .send({
        fullName: 'Học Viên 14 Tuổi',
        dateOfBirth: '2012-04-10',
        phone: '0901110002',
        email: 'teen.missing@example.com',
        password: 'Password@123',
      })
      .expect(400);

    expect((missingConsentRes.body as ProblemBody).detail).toBe(
      'Vui lòng xác nhận đã có sự đồng ý của cha mẹ',
    );

    // Sibling 1 (14 years old) with parent email -> 201
    const sibling1Res = await request(app.getHttpServer())
      .post('/api/v1/auth/register/student')
      .send({
        fullName: 'Nguyễn Minh Anh',
        dateOfBirth: '2012-04-10',
        phone: '0901110003',
        email: 'anh.sibling@example.com',
        password: 'Password@123',
        guardianEmail: 'parent.shared@example.com',
        guardianConsent: true,
      })
      .expect(201);

    // Sibling 2 (13 years old) with exact same parent guardianEmail via /auth/register -> 201
    const sibling2Res = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        fullName: 'Nguyễn Minh Em',
        dateOfBirth: '2013-07-20',
        phone: '0901110004',
        email: 'em.sibling@example.com',
        password: 'Password@123',
        guardianEmail: 'parent.shared@example.com',
        guardianConsent: true,
      })
      .expect(201);

    expect((sibling1Res.body as RegisterSuccessBody).user.status).toBe('PENDING_CLASS');
    expect((sibling2Res.body as RegisterSuccessBody).user.status).toBe('PENDING_CLASS');
    expect(fakePrisma.guardianConsents.size).toBe(2);

    // Duplicate email or phone -> 409 Conflict
    const dupRes = await request(app.getHttpServer())
      .post('/api/v1/auth/register/student')
      .send({
        fullName: 'Trùng Số ĐT',
        dateOfBirth: '2002-01-01',
        phone: '0901110003',
        email: 'unique.other@example.com',
        password: 'Password@123',
      })
      .expect(409);

    expect((dupRes.body as ProblemBody).detail).toBe(
      'Email/Số điện thoại đã được sử dụng',
    );
  });

  it('enforces email-only login (phone in email -> 400), dummy bcrypt on unknown email, Set-Cookie on success, and 5-strike 15m lockout (FUNC-003, DEC-023)', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        fullName: 'Học Viên Đăng Nhập',
        dateOfBirth: '2001-09-15',
        phone: '0902220001',
        email: 'student.login@example.com',
        password: 'Correct@123',
      })
      .expect(201);

    // Entering phone number into email field -> 400 Bad Request (DEC-023)
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: '0902220001',
        password: 'Correct@123',
      })
      .expect(400);

    // Non-existent email still runs dummy bcrypt compare (SEC-05)
    const compareSpy = vi.spyOn(bcrypt, 'compare');
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'nobody.here@example.com',
        password: 'SomePassword@123',
      })
      .expect(401);
    expect(compareSpy).toHaveBeenCalledTimes(1);
    compareSpy.mockRestore();

    // Valid login -> 200 + HttpOnly SameSite=Lax cookie + accessToken
    const okLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'student.login@example.com',
        password: 'Correct@123',
      })
      .expect(200);

    const setCookieHeader = okLogin.headers['set-cookie'];
    const cookieStr = Array.isArray(setCookieHeader)
      ? setCookieHeader.join('; ')
      : String(setCookieHeader ?? '');
    expect(cookieStr).toContain('webedu_access_token=');
    expect(cookieStr).toContain('HttpOnly');
    expect(cookieStr).toMatch(/SameSite=Lax/i);

    const loginBody = okLogin.body as LoginSuccessBody;
    expect(loginBody.accessToken).toBeTruthy();
    expect(loginBody.redirectTo).toBe('/student/overview');

    // 5 consecutive wrong password attempts -> 4x 401 then 5th returns 403 and sets lockedUntil
    for (let attempt = 1; attempt <= 4; attempt += 1) {
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: 'student.login@example.com',
          password: 'WrongPassword@999',
        })
        .expect(401);
    }

    const fifthRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'student.login@example.com',
        password: 'WrongPassword@999',
      })
      .expect(403);

    expect((fifthRes.body as ProblemBody).detail).toBe(
      'Tài khoản tạm khóa 15 phút do nhập sai mật khẩu quá 5 lần',
    );

    const storedUser = Array.from(fakePrisma.users.values()).find(
      (u) => u.email === 'student.login@example.com',
    );
    expect(storedUser?.lockedUntil).toBeInstanceOf(Date);

    // Even with correct password during lockout window -> 403
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'student.login@example.com',
        password: 'Correct@123',
      })
      .expect(403);
  });

  it('revokes JWT immediately on logout via tokenVersion increment so reused token gets 401 on GET /api/v1/profile/me (FUNC-004)', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        fullName: 'Học Viên Logout',
        dateOfBirth: '2000-03-03',
        phone: '0903330001',
        email: 'logout.user@example.com',
        password: 'Password@123',
      })
      .expect(201);

    const loginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'logout.user@example.com',
        password: 'Password@123',
      })
      .expect(200);

    const token = (loginRes.body as LoginSuccessBody).accessToken;

    // Profile works before logout
    await request(app.getHttpServer())
      .get('/api/v1/profile/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    // Logout increments tokenVersion
    await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    // Reusing old JWT is rejected with 401
    await request(app.getHttpServer())
      .get('/api/v1/profile/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(401);
  });

  it('enforces identical forgot-password message & 60s 429 cooldown for existing and non-existing emails (SEC-06) and single-use reset-password token (FUNC-005)', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        fullName: 'Học Viên Quên MK',
        dateOfBirth: '2001-06-06',
        phone: '0904440001',
        email: 'forgot.exists@example.com',
        password: 'OldPassword@123',
      })
      .expect(201);

    // Non-existing email: 1st call -> 200, 2nd immediate call -> 429
    const ghostFirst = await request(app.getHttpServer())
      .post('/api/v1/auth/forgot-password')
      .send({ email: 'ghost.unknown@example.com' })
      .expect(200);

    await request(app.getHttpServer())
      .post('/api/v1/auth/forgot-password')
      .send({ email: 'ghost.unknown@example.com' })
      .expect(429);

    // Existing email: 1st call -> 200 with exact same message, 2nd immediate call -> 429
    const realFirst = await request(app.getHttpServer())
      .post('/api/v1/auth/forgot-password')
      .send({ email: 'forgot.exists@example.com' })
      .expect(200);

    await request(app.getHttpServer())
      .post('/api/v1/auth/forgot-password')
      .send({ email: 'forgot.exists@example.com' })
      .expect(429);

    const ghostBody = ghostFirst.body as ForgotPasswordBody;
    const realBody = realFirst.body as ForgotPasswordBody;
    expect(ghostBody.message).toBe(realBody.message);
    expect(realBody.debugResetToken).toBeTruthy();

    const resetToken = realBody.debugResetToken!;

    // First use of reset token -> 200 OK
    await request(app.getHttpServer())
      .post('/api/v1/auth/reset-password')
      .send({
        token: resetToken,
        newPassword: 'BrandNewPassword@456',
        confirmPassword: 'BrandNewPassword@456',
      })
      .expect(200);

    // Second use (replay) of same reset token -> 400 Bad Request
    await request(app.getHttpServer())
      .post('/api/v1/auth/reset-password')
      .send({
        token: resetToken,
        newPassword: 'AnotherPassword@789',
      })
      .expect(400);

    // Can now login with new password
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'forgot.exists@example.com',
        password: 'BrandNewPassword@456',
      })
      .expect(200);
  });

  it('FUNC-078 E2E (P0-3): rotates tokenVersion on password change and email change while minting fresh JWT + Set-Cookie for current session', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        fullName: 'Học Viên Đổi MK & Email',
        dateOfBirth: '2000-04-04',
        phone: '0905550001',
        email: 'profile.session@example.com',
        password: 'InitPassword@123',
      })
      .expect(201);

    const loginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'profile.session@example.com',
        password: 'InitPassword@123',
      })
      .expect(200);

    const token1 = (loginRes.body as LoginSuccessBody).accessToken;

    // 1. Change password -> returns fresh accessToken + Set-Cookie
    const changePwdRes = await request(app.getHttpServer())
      .post('/api/v1/profile/change-password')
      .set('Authorization', `Bearer ${token1}`)
      .send({
        currentPassword: 'InitPassword@123',
        newPassword: 'UpdatedPassword@456',
        confirmPassword: 'UpdatedPassword@456',
      })
      .expect(200);

    const changePwdBody = changePwdRes.body as { message: string; accessToken?: string };
    expect(changePwdBody.accessToken).toBeTruthy();
    const token2 = changePwdBody.accessToken!;

    const pwdCookies = changePwdRes.headers['set-cookie'];
    const pwdCookieHeader = Array.isArray(pwdCookies) ? pwdCookies[0]! : String(pwdCookies ?? '');
    expect(pwdCookieHeader).toContain('webedu_access_token=');

    // Old token1 is revoked immediately -> 401
    await request(app.getHttpServer())
      .get('/api/v1/profile/me')
      .set('Authorization', `Bearer ${token1}`)
      .expect(401);

    // New token2 AND new cookie both succeed -> 200 OK
    await request(app.getHttpServer())
      .get('/api/v1/profile/me')
      .set('Authorization', `Bearer ${token2}`)
      .expect(200);

    const cookiePair2 = pwdCookieHeader.split(';')[0]!;
    await request(app.getHttpServer())
      .get('/api/v1/profile/me')
      .set('Cookie', cookiePair2)
      .expect(200);

    // 2. Change email via Cookie + valid Origin -> returns fresh accessToken + Set-Cookie
    const updateEmailRes = await request(app.getHttpServer())
      .patch('/api/v1/profile/me')
      .set('Cookie', cookiePair2)
      .set('Origin', 'http://localhost:3000')
      .send({
        email: 'profile.newemail@example.com',
        currentPassword: 'UpdatedPassword@456',
      })
      .expect(200);

    const updateEmailBody = updateEmailRes.body as { email: string; accessToken?: string };
    expect(updateEmailBody.email).toBe('profile.newemail@example.com');
    expect(updateEmailBody.accessToken).toBeTruthy();
    const token3 = updateEmailBody.accessToken!;

    const emailCookies = updateEmailRes.headers['set-cookie'];
    const emailCookieHeader = Array.isArray(emailCookies)
      ? emailCookies[0]!
      : String(emailCookies ?? '');
    const cookiePair3 = emailCookieHeader.split(';')[0]!;

    // Previous token2 is revoked -> 401
    await request(app.getHttpServer())
      .get('/api/v1/profile/me')
      .set('Authorization', `Bearer ${token2}`)
      .expect(401);

    // Fresh token3 and cookiePair3 both return 200 OK
    await request(app.getHttpServer())
      .get('/api/v1/profile/me')
      .set('Authorization', `Bearer ${token3}`)
      .expect(200);

    await request(app.getHttpServer())
      .get('/api/v1/profile/me')
      .set('Cookie', cookiePair3)
      .expect(200);
  });

  it('FUNC-004 E2E: enforces 60-minute Idle Timeout even when rememberMe=true 7-day JWT is used', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        fullName: 'Học Viên Idle Timeout',
        dateOfBirth: '2000-07-07',
        phone: '0906660001',
        email: 'idle.timeout@example.com',
        password: 'Password@123',
      })
      .expect(201);

    const loginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'idle.timeout@example.com',
        password: 'Password@123',
        rememberMe: true,
      })
      .expect(200);

    const body = loginRes.body as LoginSuccessBody;
    expect(body.expiresIn).toBe(7 * 24 * 60 * 60);

    await request(app.getHttpServer())
      .get('/api/v1/profile/me')
      .set('Authorization', `Bearer ${body.accessToken}`)
      .expect(200);

    // Rewind lastActivityAt by 61 minutes
    const userRecord = Array.from(fakePrisma.users.values()).find(
      (u) => u.email === 'idle.timeout@example.com',
    )!;
    userRecord.lastActivityAt = new Date(Date.now() - 61 * 60 * 1000);

    const expiredRes = await request(app.getHttpServer())
      .get('/api/v1/profile/me')
      .set('Authorization', `Bearer ${body.accessToken}`)
      .expect(401);

    expect((expiredRes.body as ProblemBody).detail).toBe(
      'Phiên đăng nhập đã hết hạn do không hoạt động quá 60 phút',
    );
  });

  it('Cookie CSRF E2E (P1-1): blocks state-changing Cookie-only requests lacking valid Origin/X-Requested-With or from evil Origin with 403', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        fullName: 'Học Viên CSRF',
        dateOfBirth: '2000-08-08',
        phone: '0907770001',
        email: 'csrf.cookie@example.com',
        password: 'Password@123',
      })
      .expect(201);

    const loginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'csrf.cookie@example.com',
        password: 'Password@123',
      })
      .expect(200);

    const rawCookies = loginRes.headers['set-cookie'];
    const cookieHeader = (Array.isArray(rawCookies) ? rawCookies[0]! : String(rawCookies ?? ''))
      .split(';')[0]!;

    // 1. POST /auth/logout with Cookie ONLY (no Origin, no X-Requested-With) -> 403
    await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .set('Cookie', cookieHeader)
      .expect(403);

    // 2. POST /auth/logout with Cookie + evil Origin -> 403
    await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .set('Cookie', cookieHeader)
      .set('Origin', 'https://evil.com')
      .expect(403);

    // Session is still alive on safe GET with Cookie
    await request(app.getHttpServer())
      .get('/api/v1/profile/me')
      .set('Cookie', cookieHeader)
      .expect(200);

    // 3. POST /auth/logout with Cookie + allowed Origin -> 200 OK
    await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .set('Cookie', cookieHeader)
      .set('Origin', 'http://localhost:3000')
      .expect(200);

    // Session is now revoked -> 401
    await request(app.getHttpServer())
      .get('/api/v1/profile/me')
      .set('Cookie', cookieHeader)
      .expect(401);
  });
});
