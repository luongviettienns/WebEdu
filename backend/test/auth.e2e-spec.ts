import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import {
  createRealE2eAppHarness,
  extractAuthCookie,
  type RealE2eAppHarness,
} from './helpers/e2e-app-harness.js';

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
  accessToken?: string;
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

describe('Authentication Flows (e2e — Real PostgreSQL & SMTP FUNC-001..005, FUNC-078)', () => {
  const vnYear = Number(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric',
    }).format(new Date()),
  );
  const DOB_UNDER_12 = `${vnYear - 8}-01-01`;
  const DOB_TEEN_14 = `${vnYear - 14}-01-01`;
  const DOB_TEEN_13 = `${vnYear - 13}-01-01`;

  let harness: RealE2eAppHarness;

  beforeAll(async () => {
    harness = await createRealE2eAppHarness();
  });

  afterAll(async () => {
    if (harness) {
      await harness.stop();
    }
  });

  beforeEach(async () => {
    await harness.resetState();
  });

  it('rejects student registration when age < 12 with 400 ProblemDetails and password > 72 chars (FUNC-001)', async () => {
    const res = await request(harness.app.getHttpServer())
      .post('/api/v1/auth/register/student')
      .send({
        fullName: 'Học Viên Nhỏ Tuổi',
        dateOfBirth: DOB_UNDER_12,
        phone: '0901110001',
        email: 'under12@example.com',
        password: 'Password@123',
      })
      .expect(400);

    expect(res.headers['content-type']).toMatch(/application\/problem\+json/);
    const body = res.body as ProblemBody;
    expect(body.status).toBe(400);
    expect(body.detail).toBe('Học viên phải từ 12 tuổi trở lên');

    await request(harness.app.getHttpServer())
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

  it('requires guardianEmail & guardianConsent for student aged 12-15 and allows two siblings to share parent guardianEmail in PostgreSQL (FUNC-002, DEC-023)', async () => {
    const missingConsentRes = await request(harness.app.getHttpServer())
      .post('/api/v1/auth/register/student')
      .send({
        fullName: 'Học Viên 14 Tuổi',
        dateOfBirth: DOB_TEEN_14,
        phone: '0901110002',
        email: 'teen.missing@example.com',
        password: 'Password@123',
      })
      .expect(400);

    expect((missingConsentRes.body as ProblemBody).detail).toBe(
      'Vui lòng xác nhận đã có sự đồng ý của cha mẹ',
    );

    const sibling1Res = await request(harness.app.getHttpServer())
      .post('/api/v1/auth/register/student')
      .send({
        fullName: 'Nguyễn Minh Anh',
        dateOfBirth: DOB_TEEN_14,
        phone: '0901110003',
        email: 'anh.sibling@example.com',
        password: 'Password@123',
        guardianEmail: 'parent.shared@example.com',
        guardianConsent: true,
      })
      .expect(201);

    const sibling2Res = await request(harness.app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        fullName: 'Nguyễn Minh Em',
        dateOfBirth: DOB_TEEN_13,
        phone: '0901110004',
        email: 'em.sibling@example.com',
        password: 'Password@123',
        guardianEmail: 'parent.shared@example.com',
        guardianConsent: true,
      })
      .expect(201);

    expect((sibling1Res.body as RegisterSuccessBody).user.status).toBe('PENDING_CLASS');
    expect((sibling2Res.body as RegisterSuccessBody).user.status).toBe('PENDING_CLASS');
    expect(await harness.prisma.guardianConsent.count()).toBe(2);

    const dupRes = await request(harness.app.getHttpServer())
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

  it('enforces email-only login, dummy bcrypt on unknown email, HttpOnly cookie-only response (no accessToken in JSON), and commits 5-strike 15m lockout to PostgreSQL (FUNC-003, DEC-023)', async () => {
    await request(harness.app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        fullName: 'Học Viên Đăng Nhập',
        dateOfBirth: '2001-09-15',
        phone: '0902220001',
        email: 'student.login@example.com',
        password: 'Correct@123',
      })
      .expect(201);

    // Phone number in email field -> 400 Bad Request
    await request(harness.app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: '0902220001',
        password: 'Correct@123',
      })
      .expect(400);

    // Unknown email still runs dummy bcrypt compare
    const compareSpy = vi.spyOn(bcrypt, 'compare');
    await request(harness.app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'nobody.here@example.com',
        password: 'SomePassword@123',
      })
      .expect(401);
    expect(compareSpy).toHaveBeenCalledTimes(1);
    compareSpy.mockRestore();

    // Valid login -> 200 + HttpOnly SameSite=Lax cookie, ZERO accessToken in JSON body
    const okLogin = await request(harness.app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'student.login@example.com',
        password: 'Correct@123',
      })
      .expect(200);

    const session = extractAuthCookie(okLogin);
    expect(session.rawSetCookie).toContain('HttpOnly');
    expect(session.rawSetCookie).toMatch(/SameSite=Lax/i);

    const loginBody = okLogin.body as LoginSuccessBody;
    expect(loginBody.accessToken).toBeUndefined();
    expect(loginBody.redirectTo).toBe('/student/overview');

    // 4 wrong attempts -> each commits failedLoginAttempts to PostgreSQL despite 401 response
    for (let attempt = 1; attempt <= 4; attempt += 1) {
      await request(harness.app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: 'student.login@example.com',
          password: 'WrongPassword@999',
        })
        .expect(401);

      const userInDb = await harness.prisma.user.findUniqueOrThrow({
        where: { email: 'student.login@example.com' },
      });
      expect(userInDb.failedLoginAttempts).toBe(attempt);
    }

    // 5th wrong attempt -> 403 and commits lockedUntil in PostgreSQL
    const fifthRes = await request(harness.app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'student.login@example.com',
        password: 'WrongPassword@999',
      })
      .expect(403);

    expect((fifthRes.body as ProblemBody).detail).toBe(
      'Tài khoản tạm khóa 15 phút do nhập sai mật khẩu quá 5 lần',
    );

    const lockedUser = await harness.prisma.user.findUniqueOrThrow({
      where: { email: 'student.login@example.com' },
    });
    expect(lockedUser.failedLoginAttempts).toBe(5);
    expect(lockedUser.lockedUntil).toBeInstanceOf(Date);

    // Valid password during active lockout window -> 403
    await request(harness.app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'student.login@example.com',
        password: 'Correct@123',
      })
      .expect(403);
  });

  it('revokes JWT immediately on logout via tokenVersion increment in PostgreSQL so reused cookie/token gets 401 (FUNC-004)', async () => {
    await request(harness.app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        fullName: 'Học Viên Logout',
        dateOfBirth: '2000-03-03',
        phone: '0903330001',
        email: 'logout.user@example.com',
        password: 'Password@123',
      })
      .expect(201);

    const loginRes = await request(harness.app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'logout.user@example.com',
        password: 'Password@123',
      })
      .expect(200);

    const { cookiePair, jwtToken } = extractAuthCookie(loginRes);

    await request(harness.app.getHttpServer())
      .get('/api/v1/profile/me')
      .set('Cookie', cookiePair)
      .expect(200);

    await request(harness.app.getHttpServer())
      .post('/api/v1/auth/logout')
      .set('Cookie', cookiePair)
      .set('Origin', 'http://localhost:3000')
      .expect(200);

    await request(harness.app.getHttpServer())
      .get('/api/v1/profile/me')
      .set('Cookie', cookiePair)
      .expect(401);

    await request(harness.app.getHttpServer())
      .get('/api/v1/profile/me')
      .set('Authorization', `Bearer ${jwtToken}`)
      .expect(401);
  });

  it('delivers password reset email over real SMTP without leaking debugResetToken, enforces 60s DB cooldown, and enforces single-use reset token (FUNC-005, SEC-06)', async () => {
    await request(harness.app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        fullName: 'Học Viên Quên MK',
        dateOfBirth: '2001-06-06',
        phone: '0904440001',
        email: 'forgot.exists@example.com',
        password: 'OldPassword@123',
      })
      .expect(201);

    const ghostFirst = await request(harness.app.getHttpServer())
      .post('/api/v1/auth/forgot-password')
      .send({ email: 'ghost.unknown@example.com' })
      .expect(200);

    await request(harness.app.getHttpServer())
      .post('/api/v1/auth/forgot-password')
      .send({ email: 'ghost.unknown@example.com' })
      .expect(429);

    const realFirst = await request(harness.app.getHttpServer())
      .post('/api/v1/auth/forgot-password')
      .send({ email: 'forgot.exists@example.com' })
      .expect(200);

    await request(harness.app.getHttpServer())
      .post('/api/v1/auth/forgot-password')
      .send({ email: 'forgot.exists@example.com' })
      .expect(429);

    const ghostBody = ghostFirst.body as ForgotPasswordBody;
    const realBody = realFirst.body as ForgotPasswordBody;
    expect(ghostBody.message).toBe(realBody.message);
    expect(realBody.debugResetToken).toBeUndefined();

    // Extract real reset token from captured SMTP wire message
    const smtpMsg = harness.smtpServer.getLatestMessageFor('forgot.exists@example.com');
    expect(smtpMsg).toBeDefined();
    const resetToken = harness.smtpServer.extractResetTokenFromMessage(smtpMsg!);
    expect(resetToken).toMatch(/^[0-9a-f]{64}$/);

    // First use -> 200 OK
    await request(harness.app.getHttpServer())
      .post('/api/v1/auth/reset-password')
      .send({
        token: resetToken,
        newPassword: 'BrandNewPassword@456',
        confirmPassword: 'BrandNewPassword@456',
      })
      .expect(200);

    // Second replay use -> 400 Bad Request
    await request(harness.app.getHttpServer())
      .post('/api/v1/auth/reset-password')
      .send({
        token: resetToken,
        newPassword: 'AnotherPassword@789',
      })
      .expect(400);

    // Login with new password -> 200 OK
    await request(harness.app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'forgot.exists@example.com',
        password: 'BrandNewPassword@456',
      })
      .expect(200);
  });

  it('FUNC-078 E2E: rotates tokenVersion on password change and email change while minting fresh HttpOnly Set-Cookie without leaking JWT in JSON body', async () => {
    await request(harness.app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        fullName: 'Học Viên Đổi MK & Email',
        dateOfBirth: '2000-04-04',
        phone: '0905550001',
        email: 'profile.session@example.com',
        password: 'InitPassword@123',
      })
      .expect(201);

    const loginRes = await request(harness.app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'profile.session@example.com',
        password: 'InitPassword@123',
        rememberMe: true,
      })
      .expect(200);

    const session1 = extractAuthCookie(loginRes);

    // 1. Change password -> rotates cookie, preserves 7-day Max-Age, omits accessToken from body
    const changePwdRes = await request(harness.app.getHttpServer())
      .post('/api/v1/profile/change-password')
      .set('Cookie', session1.cookiePair)
      .set('Origin', 'http://localhost:3000')
      .send({
        currentPassword: 'InitPassword@123',
        newPassword: 'UpdatedPassword@456',
        confirmPassword: 'UpdatedPassword@456',
      })
      .expect(200);

    const session2 = extractAuthCookie(changePwdRes);
    expect(session2.rawSetCookie).toContain('Max-Age=604800');

    // Old session1 is immediately invalid -> 401
    await request(harness.app.getHttpServer())
      .get('/api/v1/profile/me')
      .set('Cookie', session1.cookiePair)
      .expect(401);

    // Fresh session2 works -> 200 OK
    await request(harness.app.getHttpServer())
      .get('/api/v1/profile/me')
      .set('Cookie', session2.cookiePair)
      .expect(200);

    // 2. Change email -> rotates cookie again, revokes session2
    const updateEmailRes = await request(harness.app.getHttpServer())
      .patch('/api/v1/profile/me')
      .set('Cookie', session2.cookiePair)
      .set('Origin', 'http://localhost:3000')
      .send({
        email: 'profile.newemail@example.com',
        currentPassword: 'UpdatedPassword@456',
      })
      .expect(200);

    const session3 = extractAuthCookie(updateEmailRes);
    expect((updateEmailRes.body as { email: string }).email).toBe(
      'profile.newemail@example.com',
    );

    await request(harness.app.getHttpServer())
      .get('/api/v1/profile/me')
      .set('Cookie', session2.cookiePair)
      .expect(401);

    await request(harness.app.getHttpServer())
      .get('/api/v1/profile/me')
      .set('Cookie', session3.cookiePair)
      .expect(200);
  });

  it('FUNC-004 E2E: enforces 60-minute Idle Timeout in PostgreSQL even when rememberMe=true 7-day cookie is used', async () => {
    await request(harness.app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        fullName: 'Học Viên Idle Timeout',
        dateOfBirth: '2000-07-07',
        phone: '0906660001',
        email: 'idle.timeout@example.com',
        password: 'Password@123',
      })
      .expect(201);

    const loginRes = await request(harness.app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'idle.timeout@example.com',
        password: 'Password@123',
        rememberMe: true,
      })
      .expect(200);

    expect((loginRes.body as LoginSuccessBody).expiresIn).toBe(7 * 24 * 60 * 60);
    const { cookiePair } = extractAuthCookie(loginRes);

    await request(harness.app.getHttpServer())
      .get('/api/v1/profile/me')
      .set('Cookie', cookiePair)
      .expect(200);

    await harness.prisma.user.update({
      where: { email: 'idle.timeout@example.com' },
      data: {
        lastActivityAt: new Date(Date.now() - 61 * 60 * 1000),
      },
    });

    const expiredRes = await request(harness.app.getHttpServer())
      .get('/api/v1/profile/me')
      .set('Cookie', cookiePair)
      .expect(401);

    expect((expiredRes.body as ProblemBody).detail).toBe(
      'Phiên đăng nhập đã hết hạn do không hoạt động quá 60 phút',
    );
    // SEC-NEW-02: Expired response explicitly clears HttpOnly cookie
    const setCookies = expiredRes.headers['set-cookie'];
    const rawClearCookie = Array.isArray(setCookies)
      ? setCookies.join('; ')
      : String(setCookies ?? '');
    expect(rawClearCookie).toMatch(/webedu_access_token=;/);

    // SEC-NEW-02 anti-resurrection: If user has an untouched 7-day rememberMe cookie on PC #1 and logs in on PC #2 after 61m idle, PC #1's stale cookie is permanently invalidated!
    const pc1Login = await request(harness.app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'idle.timeout@example.com',
        password: 'Password@123',
        rememberMe: true,
      })
      .expect(200);
    const pc1Cookie = extractAuthCookie(pc1Login).cookiePair;

    await harness.prisma.user.update({
      where: { email: 'idle.timeout@example.com' },
      data: {
        lastActivityAt: new Date(Date.now() - 61 * 60 * 1000),
      },
    });

    // User logs in fresh on PC #2 (refreshes lastActivityAt AND increments tokenVersion because previous activity was >60m idle)
    const pc2Login = await request(harness.app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'idle.timeout@example.com',
        password: 'Password@123',
      })
      .expect(200);
    const pc2Cookie = extractAuthCookie(pc2Login).cookiePair;

    // Untouched PC #1 7-day cookie MUST NOT resurrect!
    await request(harness.app.getHttpServer())
      .get('/api/v1/profile/me')
      .set('Cookie', pc1Cookie)
      .expect(401);

    // PC #2 cookie works normally
    await request(harness.app.getHttpServer())
      .get('/api/v1/profile/me')
      .set('Cookie', pc2Cookie)
      .expect(200);
  });

  it('Cookie & Login CSRF E2E: blocks cross-origin & form-urlencoded @Public() POSTs and blocks Cookie-only mutations lacking trusted Origin (SEC-NEW-03)', async () => {
    await request(harness.app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        fullName: 'Học Viên CSRF',
        dateOfBirth: '2000-08-08',
        phone: '0907770001',
        email: 'csrf.cookie@example.com',
        password: 'Password@123',
      })
      .expect(201);

    // SEC-NEW-03: Cross-origin POST to @Public() /auth/login is blocked with 403
    await request(harness.app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('Origin', 'https://evil.com')
      .send({
        email: 'csrf.cookie@example.com',
        password: 'Password@123',
      })
      .expect(403);

    // SEC-NEW-03: HTML <form method="POST"> application/x-www-form-urlencoded body is NOT parsed (rejected 400)
    await request(harness.app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('Origin', 'http://localhost:3000')
      .set('Content-Type', 'application/x-www-form-urlencoded')
      .send('email=csrf.cookie%40example.com&password=Password%40123')
      .expect(400);

    const loginRes = await request(harness.app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('Origin', 'http://localhost:3000')
      .send({
        email: 'csrf.cookie@example.com',
        password: 'Password@123',
      })
      .expect(200);

    const { cookiePair } = extractAuthCookie(loginRes);

    // Missing Origin and X-Requested-With -> 403
    await request(harness.app.getHttpServer())
      .post('/api/v1/auth/logout')
      .set('Cookie', cookiePair)
      .expect(403);

    // Evil Origin -> 403
    await request(harness.app.getHttpServer())
      .post('/api/v1/auth/logout')
      .set('Cookie', cookiePair)
      .set('Origin', 'https://evil.com')
      .expect(403);

    // Safe GET still alive -> 200
    await request(harness.app.getHttpServer())
      .get('/api/v1/profile/me')
      .set('Cookie', cookiePair)
      .expect(200);

    // Allowed Origin -> 200 OK
    await request(harness.app.getHttpServer())
      .post('/api/v1/auth/logout')
      .set('Cookie', cookiePair)
      .set('Origin', 'http://localhost:3000')
      .expect(200);

    await request(harness.app.getHttpServer())
      .get('/api/v1/profile/me')
      .set('Cookie', cookiePair)
      .expect(401);
  });
});
