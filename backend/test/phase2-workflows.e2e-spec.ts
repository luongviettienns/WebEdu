import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import bcrypt from 'bcryptjs';
import {
  ClassStatus,
  CourseLevel,
  Role,
  UserStatus,
} from '@prisma/client';
import request from 'supertest';
import {
  createRealE2eAppHarness,
  extractAuthCookie,
  type ExtractedCookieSession,
  type RealE2eAppHarness,
} from './helpers/e2e-app-harness.js';
import { registerStudentViaHttpWithOtp } from './helpers/auth-test-helpers.js';

describe('Phase 2 Full Domain Workflows (e2e — Real PostgreSQL FUNC-006..012)', () => {
  const vnYear = Number(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric',
    }).format(new Date()),
  );
  const DOB_TEEN_14 = `${vnYear - 14}-01-01`;

  let harness: RealE2eAppHarness;
  const PASSWORD = 'AdminPassword@123';
  let passwordHash: string;

  async function loginSession(email: string, password = PASSWORD): Promise<ExtractedCookieSession> {
    const res = await request(harness.app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password })
      .expect(200);
    return extractAuthCookie(res);
  }

  beforeAll(async () => {
    harness = await createRealE2eAppHarness();
    passwordHash = await bcrypt.hash(PASSWORD, 10);
  });

  afterAll(async () => {
    if (harness) {
      await harness.stop();
    }
  });

  beforeEach(async () => {
    await harness.resetState();

    await harness.prisma.user.createMany({
      data: [
        {
          id: 'u-admin-main',
          email: 'admin@webedu.vn',
          phone: '0920000001',
          fullName: 'Quản Trị Đào Tạo Chính',
          passwordHash,
          roles: [Role.ADMIN],
          status: UserStatus.ACTIVE,
        },
        {
          id: 'u-sa-main',
          email: 'superadmin@webedu.vn',
          phone: '0920000002',
          fullName: 'Quản Trị Hệ Thống Chính',
          passwordHash,
          roles: [Role.SUPERADMIN],
          status: UserStatus.ACTIVE,
        },
      ],
    });
  });

  it('Teachers CRUD & Profile Active Classes: Paginates list, creates teacher, computes activeClassesCount from PostgreSQL classes, blocks locking active class teacher (409), allows locking completed class teacher (200) (FUNC-006)', async () => {
    const adminSession = await loginSession('admin@webedu.vn');

    // Create Teacher via HTTP
    const createRes = await request(harness.app.getHttpServer())
      .post('/api/v1/teachers')
      .set('Cookie', adminSession.cookiePair)
      .set('Origin', 'http://localhost:3000')
      .send({
        fullName: 'Cô Trương Mỹ Lan (张美兰)',
        email: 'lan.teacher@webedu.vn',
        phone: '0931000001',
        initialPassword: PASSWORD,
        notes: 'HSK 4-6 & Giao tiếp thương mại',
      })
      .expect(201);

    const teacherId = (createRes.body as { id: string }).id;

    // Duplicate email -> 409
    await request(harness.app.getHttpServer())
      .post('/api/v1/teachers')
      .set('Cookie', adminSession.cookiePair)
      .set('Origin', 'http://localhost:3000')
      .send({
        fullName: 'Trùng Email GV',
        email: 'lan.teacher@webedu.vn',
        phone: '0931000099',
        initialPassword: PASSWORD,
      })
      .expect(409);

    // Create Course + ACTIVE Class led by this teacher
    const course = await harness.prisma.course.create({
      data: {
        code: 'HSK4',
        name: 'HSK 4 Trung Cấp',
        level: CourseLevel.HSK4,
      },
    });

    const cls = await harness.prisma.class.create({
      data: {
        code: 'HSK4-K26-01',
        courseId: course.id,
        teacherId,
        status: ClassStatus.ACTIVE,
        startDate: new Date('2026-10-01T00:00:00.000Z'),
        notes: 'Lớp HSK4 Tối 2-4-6',
      },
    });

    // Paginated GET /api/v1/teachers reflects real activeClassesCount = 1
    const listRes = await request(harness.app.getHttpServer())
      .get('/api/v1/teachers?page=1&limit=10&search=Trương')
      .set('Cookie', adminSession.cookiePair)
      .expect(200);

    const listBody = listRes.body as {
      items: Array<{ id: string; activeClassesCount: number }>;
      total: number;
      page: number;
      limit: number;
    };
    expect(listBody.total).toBe(1);
    expect(listBody.page).toBe(1);
    expect(listBody.items[0]?.activeClassesCount).toBe(1);

    // Teacher GET /api/v1/profile/me also reflects live activeClassesCount = 1
    const teacherSession = await loginSession('lan.teacher@webedu.vn');
    const teacherProfileRes = await request(harness.app.getHttpServer())
      .get('/api/v1/profile/me')
      .set('Cookie', teacherSession.cookiePair)
      .expect(200);
    expect(
      (teacherProfileRes.body as { activeClassesCount: number }).activeClassesCount,
    ).toBe(1);

    // Attempt to deactivate teacher while leading ACTIVE class -> 409 Conflict
    await request(harness.app.getHttpServer())
      .patch(`/api/v1/teachers/${teacherId}`)
      .set('Cookie', adminSession.cookiePair)
      .set('Origin', 'http://localhost:3000')
      .send({ status: UserStatus.INACTIVE })
      .expect(409);

    // Mark class COMPLETED -> deactivating teacher now succeeds (200) and revokes teacher's session cookie
    await harness.prisma.class.update({
      where: { id: cls.id },
      data: { status: ClassStatus.COMPLETED },
    });

    await request(harness.app.getHttpServer())
      .patch(`/api/v1/teachers/${teacherId}`)
      .set('Cookie', adminSession.cookiePair)
      .set('Origin', 'http://localhost:3000')
      .send({ status: UserStatus.INACTIVE })
      .expect(200);

    const revokedTeacherRes = await request(harness.app.getHttpServer())
      .get('/api/v1/profile/me')
      .set('Cookie', teacherSession.cookiePair);
    expect([401, 403]).toContain(revokedTeacherRes.status);
  });

  it('Students CRUD, DOB Consent Lock & FUNC-008 Initial Class Enrollment: Blocks status bypass, lists real available classes, rejects invalid/completed classes, and serializes concurrent initial enrollment', async () => {
    const adminSession = await loginSession('admin@webedu.vn');

    // Register a 14-year-old student (creates GuardianConsent & PENDING_CLASS)
    const regRes = await registerStudentViaHttpWithOtp(
      harness.app,
      harness.smtpServer,
      {
        fullName: 'Lê Hoàng Nam (黎皇南)',
        dateOfBirth: DOB_TEEN_14,
        phone: '0941000001',
        email: 'phuhuynh.nam@example.com',
        password: PASSWORD,
        guardianConsent: true,
      },
      '/api/v1/auth/register/student',
    );
    expect(regRes.status).toBe(201);

    const studentId = (regRes.body as { user: { id: string } }).user.id;

    // Pending enrollment queue pagination returns student
    const queueRes = await request(harness.app.getHttpServer())
      .get('/api/v1/students/pending-enrollment?page=1&limit=10')
      .set('Cookie', adminSession.cookiePair)
      .expect(200);
    expect((queueRes.body as { total: number }).total).toBe(1);

    // Attempt to bypass initial enrollment via PATCH /students/:id status=ACTIVE -> 400
    await request(harness.app.getHttpServer())
      .patch(`/api/v1/students/${studentId}`)
      .set('Cookie', adminSession.cookiePair)
      .set('Origin', 'http://localhost:3000')
      .send({ status: UserStatus.ACTIVE })
      .expect(400);

    // Attempt 2-step bypass: PENDING_CLASS -> INACTIVE -> ACTIVE -> 400 on second step!
    await request(harness.app.getHttpServer())
      .patch(`/api/v1/students/${studentId}`)
      .set('Cookie', adminSession.cookiePair)
      .set('Origin', 'http://localhost:3000')
      .send({ status: UserStatus.INACTIVE })
      .expect(200);

    await request(harness.app.getHttpServer())
      .patch(`/api/v1/students/${studentId}`)
      .set('Cookie', adminSession.cookiePair)
      .set('Origin', 'http://localhost:3000')
      .send({ status: UserStatus.ACTIVE })
      .expect(400);

    // Restore back to PENDING_CLASS for unenrolled student -> allowed (200)
    await request(harness.app.getHttpServer())
      .patch(`/api/v1/students/${studentId}`)
      .set('Cookie', adminSession.cookiePair)
      .set('Origin', 'http://localhost:3000')
      .send({ status: UserStatus.PENDING_CLASS })
      .expect(200);

    // Attempt to mutate locked dateOfBirth (GuardianConsent exists) -> 400
    await request(harness.app.getHttpServer())
      .patch(`/api/v1/students/${studentId}`)
      .set('Cookie', adminSession.cookiePair)
      .set('Origin', 'http://localhost:3000')
      .send({ dateOfBirth: '2008-01-01' })
      .expect(400);

    // Attempt to assign non-existent class -> 404
    await request(harness.app.getHttpServer())
      .post(`/api/v1/students/${studentId}/assign-initial-class`)
      .set('Cookie', adminSession.cookiePair)
      .set('Origin', 'http://localhost:3000')
      .send({ classNameOrId: 'NON-EXISTENT-999' })
      .expect(404);

    // Seed real Teacher, Course, COMPLETED class, and UPCOMING class
    const teacher = await harness.prisma.user.create({
      data: {
        email: 'gv.hsk1@webedu.vn',
        phone: '0941000099',
        fullName: 'Thầy Vương',
        passwordHash,
        roles: [Role.TEACHER],
        status: UserStatus.ACTIVE,
      },
    });
    const course = await harness.prisma.course.create({
      data: { code: 'HSK1', name: 'HSK 1 Sơ Cấp', level: CourseLevel.HSK1 },
    });
    await harness.prisma.class.create({
      data: {
        code: 'HSK1-OLD-00',
        courseId: course.id,
        teacherId: teacher.id,
        status: ClassStatus.COMPLETED,
        startDate: new Date('2026-01-01T00:00:00.000Z'),
      },
    });
    const openClass = await harness.prisma.class.create({
      data: {
        code: 'HSK1-K26-01',
        courseId: course.id,
        teacherId: teacher.id,
        status: ClassStatus.UPCOMING,
        startDate: new Date('2026-11-15T00:00:00.000Z'),
      },
    });

    // GET /api/v1/students/available-classes returns ONLY open UPCOMING/ACTIVE classes (never COMPLETED)
    const availRes = await request(harness.app.getHttpServer())
      .get('/api/v1/students/available-classes')
      .set('Cookie', adminSession.cookiePair)
      .expect(200);
    const availItems = (availRes.body as { items: Array<{ code: string }> }).items;
    expect(availItems.map((c) => c.code)).toEqual(['HSK1-K26-01']);

    // Assigning COMPLETED class -> 400
    await request(harness.app.getHttpServer())
      .post(`/api/v1/students/${studentId}/assign-initial-class`)
      .set('Cookie', adminSession.cookiePair)
      .set('Origin', 'http://localhost:3000')
      .send({ classNameOrId: 'HSK1-OLD-00' })
      .expect(400);

    // Concurrent initial enrollment requests -> strictly ONE 200 and ONE rejected (400 after FOR UPDATE sees ACTIVE, or 409 on unique index)!
    const [assign1, assign2] = await Promise.all([
      request(harness.app.getHttpServer())
        .post(`/api/v1/students/${studentId}/assign-initial-class`)
        .set('Cookie', adminSession.cookiePair)
        .set('Origin', 'http://localhost:3000')
        .send({ classNameOrId: openClass.id }),
      request(harness.app.getHttpServer())
        .post(`/api/v1/students/${studentId}/assign-initial-class`)
        .set('Cookie', adminSession.cookiePair)
        .set('Origin', 'http://localhost:3000')
        .send({ classNameOrId: 'HSK1-K26-01' }),
    ]);

    const statuses = [assign1.status, assign2.status].sort((a, b) => a - b);
    expect(statuses[0]).toBe(200);
    expect([400, 409]).toContain(statuses[1]);
    expect(
      await harness.prisma.enrollment.count({ where: { studentId } }),
    ).toBe(1);

    // Once enrolled, reverting status back to PENDING_CLASS is blocked -> 400
    await request(harness.app.getHttpServer())
      .patch(`/api/v1/students/${studentId}`)
      .set('Cookie', adminSession.cookiePair)
      .set('Origin', 'http://localhost:3000')
      .send({ status: UserStatus.PENDING_CLASS })
      .expect(400);
  });

  it('System Settings, ~1.5MB Base64 Logo Upload (4mb body limit), Paginated Users & Sanitized Audit Logs (FUNC-011, FUNC-012, FUNC-013)', async () => {
    const saSession = await loginSession('superadmin@webedu.vn');

    // Create new Admin + Teacher account via POST /system-settings/users
    const createdUserRes = await request(harness.app.getHttpServer())
      .post('/api/v1/system-settings/users')
      .set('Cookie', saSession.cookiePair)
      .set('Origin', 'http://localhost:3000')
      .send({
        fullName: 'Quản Trị Kiêm Giáo Viên',
        email: 'dual.admin.gv@webedu.vn',
        phone: '0951000001',
        initialPassword: 'SecretUserPass@999',
        roles: [Role.ADMIN, Role.TEACHER],
      })
      .expect(201);

    const dualUserId = (createdUserRes.body as { id: string }).id;

    // Filter system users by search query with pagination
    const usersListRes = await request(harness.app.getHttpServer())
      .get('/api/v1/system-settings/users?page=1&limit=10&search=dual.admin.gv')
      .set('Cookie', saSession.cookiePair)
      .expect(200);
    expect((usersListRes.body as { total: number }).total).toBe(1);

    // Construct a ~1.5MB valid PNG payload (~2.0MB base64 JSON > 100kb default Express limit!)
    const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const bodyBytes = Buffer.alloc(1_500_000, 0x41);
    const fullPngBuffer = Buffer.concat([pngSignature, bodyBytes]);
    const validLargePngDataUrl = `data:image/png;base64,${fullPngBuffer.toString('base64')}`;

    const configUpdateRes = await request(harness.app.getHttpServer())
      .put('/api/v1/system-settings/config')
      .set('Cookie', saSession.cookiePair)
      .set('Origin', 'http://localhost:3000')
      .send({
        centerName: 'Trung Tâm Tiếng Trung TD Hán Ngữ (天地汉语)',
        centerLogoBase64: validLargePngDataUrl,
      })
      .expect(200);

    expect((configUpdateRes.body as { centerName: string }).centerName).toBe(
      'Trung Tâm Tiếng Trung TD Hán Ngữ (天地汉语)',
    );

    // Public GET /api/v1/system-settings/config works without authentication -> 200
    const publicConfigRes = await request(harness.app.getHttpServer())
      .get('/api/v1/system-settings/config')
      .expect(200);
    expect((publicConfigRes.body as { centerName: string }).centerName).toBe(
      'Trung Tâm Tiếng Trung TD Hán Ngữ (天地汉语)',
    );

    // Spoofed SVG disguised as data:image/png -> rejected by magic-byte check with 400
    const spoofedSvgAsPng = `data:image/png;base64,${Buffer.from('<svg onload="alert(1)"></svg>').toString('base64')}`;
    await request(harness.app.getHttpServer())
      .put('/api/v1/system-settings/config')
      .set('Cookie', saSession.cookiePair)
      .set('Origin', 'http://localhost:3000')
      .send({
        centerName: 'Spoof Attempt',
        centerLogoBase64: spoofedSvgAsPng,
      })
      .expect(400);

    // Role mutation revokes target user's active session immediately
    const dualSession = await loginSession('dual.admin.gv@webedu.vn', 'SecretUserPass@999');
    await request(harness.app.getHttpServer())
      .patch(`/api/v1/system-settings/users/${dualUserId}/roles`)
      .set('Cookie', saSession.cookiePair)
      .set('Origin', 'http://localhost:3000')
      .send({ roles: [Role.ADMIN] })
      .expect(200);

    await request(harness.app.getHttpServer())
      .get('/api/v1/profile/me')
      .set('Cookie', dualSession.cookiePair)
      .expect(401);

    // Audit logs endpoint returns paginated entries with zero leaked passwords/tokens
    const auditRes = await request(harness.app.getHttpServer())
      .get('/api/v1/system-settings/audit-logs?page=1&limit=20')
      .set('Cookie', saSession.cookiePair)
      .expect(200);

    const serializedAudit = JSON.stringify(auditRes.body);
    expect(serializedAudit).not.toContain('SecretUserPass@999');
    expect(serializedAudit).not.toContain('passwordHash');
    expect((auditRes.body as { items: unknown[] }).items.length).toBeGreaterThanOrEqual(3);
  });
});
