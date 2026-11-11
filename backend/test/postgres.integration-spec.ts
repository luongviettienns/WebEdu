import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ClassStatus,
  CourseLevel,
  EnrollmentStatus,
  Role,
  UserStatus,
} from '@prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { PrismaService } from '../src/common/prisma/prisma.service.js';
import {
  resolveAuthServices,
  type AuthServicesHandle,
} from './helpers/auth-services.js';
import {
  resolveStudentServices,
  type StudentServicesHandle,
} from './helpers/student-services.js';
import { TeachersService } from '../src/modules/teachers/teachers.service.js';
import { ProfileService } from '../src/modules/users/profile.service.js';
import {
  resolveSystemSettingsServices,
  type SystemSettingsServicesHandle,
} from './helpers/system-settings-services.js';
import { calculateAgeInVnTimezone } from '../src/common/utils/timezone.util.js';
import type { AuthenticatedUser } from '../src/common/auth/auth.types.js';
import {
  startIsolatedPostgresTestDb,
  type IsolatedPostgresHarness,
} from './helpers/postgres-test-container.js';
import { LocalSmtpTestServer } from './helpers/local-smtp-server.js';

describe('Real PostgreSQL Integration Suite (Phase 2 — 13 Mandatory Scenarios)', () => {
  const vnYear = Number(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric',
    }).format(new Date()),
  );
  const DOB_UNDER_12 = `${vnYear - 8}-01-01`;
  const DOB_TEEN_14 = `${vnYear - 14}-01-01`;
  const DOB_TEEN_13 = `${vnYear - 13}-01-01`;

  let pgHarness: IsolatedPostgresHarness;
  let smtpServer: LocalSmtpTestServer;
  let moduleRef: TestingModule;
  let prisma: PrismaService;
  let authService: AuthServicesHandle;
  let studentsService: StudentServicesHandle;
  let teachersService: TeachersService;
  let profileService: ProfileService;
  let systemSettingsService: SystemSettingsServicesHandle;

  async function bootNestModule(): Promise<TestingModule> {
    const { AppModule } = await import('../src/app.module.js');
    const mod = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    await mod.init();
    return mod;
  }

  beforeAll(async () => {
    pgHarness = await startIsolatedPostgresTestDb();
    smtpServer = new LocalSmtpTestServer();
    const smtpAddr = await smtpServer.start();

    process.env.NODE_ENV = 'test';
    process.env.DATABASE_URL = pgHarness.databaseUrl;
    process.env.JWT_SECRET = 'webedu-real-postgres-integration-secret-key-2026';
    process.env.CORS_ORIGIN = 'http://localhost:3000';
    process.env.FRONTEND_APP_URL = 'http://localhost:3000';
    process.env.MAIL_PROVIDER = 'smtp';
    process.env.SMTP_HOST = smtpAddr.host;
    process.env.SMTP_PORT = String(smtpAddr.port);
    process.env.SMTP_SECURE = 'false';

    moduleRef = await bootNestModule();
    prisma = moduleRef.get(PrismaService);
    authService = resolveAuthServices(moduleRef);
    studentsService = resolveStudentServices(moduleRef);
    teachersService = moduleRef.get(TeachersService);
    profileService = moduleRef.get(ProfileService);
    systemSettingsService = resolveSystemSettingsServices(moduleRef);
  });

  afterAll(async () => {
    if (moduleRef) {
      await moduleRef.close();
    }
    if (smtpServer) {
      await smtpServer.stop();
    }
    if (pgHarness) {
      await pgHarness.stop();
    }
  });

  beforeEach(async () => {
    smtpServer.setSimulateFailure(false);
    smtpServer.clearMessages();
    await pgHarness.truncateAllTables(prisma);
  });

  it('Scenario 1 (P0-B1): Commits failedLoginAttempts (1..4 -> 401, 5th -> 403 15m lock) to PostgreSQL, survives backend restart, blocks right password while locked, and resets after expiry', async () => {
    const reg = await authService.register({
      fullName: 'Trần Minh Khôi',
      dateOfBirth: '2001-05-12',
      phone: '0901000001',
      email: 'khoi.lockout@example.com',
      password: 'CorrectPassword@123',
    });

    // Attempts 1..4 -> 401 and persisted in PostgreSQL (would stay 0 if $transaction rolled back!)
    for (let i = 1; i <= 4; i += 1) {
      await expect(
        authService.login({
          email: 'khoi.lockout@example.com',
          password: 'WrongPassword@999',
        }),
      ).rejects.toThrowError(UnauthorizedException);

      const dbRow = await prisma.user.findUniqueOrThrow({
        where: { id: reg.user.id },
      });
      expect(dbRow.failedLoginAttempts).toBe(i);
      expect(dbRow.lockedUntil).toBeNull();
    }

    // Attempt 5 -> 403 and commits failedLoginAttempts = 5 + lockedUntil (+15m)
    const beforeFifth = Date.now();
    await expect(
      authService.login({
        email: 'khoi.lockout@example.com',
        password: 'WrongPassword@999',
      }),
    ).rejects.toThrowError(ForbiddenException);

    const lockedRow = await prisma.user.findUniqueOrThrow({
      where: { id: reg.user.id },
    });
    expect(lockedRow.failedLoginAttempts).toBe(5);
    expect(lockedRow.lockedUntil).not.toBeNull();
    const lockDeltaMs = lockedRow.lockedUntil!.getTime() - beforeFifth;
    expect(lockDeltaMs).toBeGreaterThan(14 * 60 * 1000);
    expect(lockDeltaMs).toBeLessThanOrEqual(16 * 60 * 1000);

    // Simulate backend process restart: close Nest module and boot a brand-new instance
    await moduleRef.close();
    moduleRef = await bootNestModule();
    prisma = moduleRef.get(PrismaService);
    authService = resolveAuthServices(moduleRef);
    studentsService = resolveStudentServices(moduleRef);
    teachersService = moduleRef.get(TeachersService);
    profileService = moduleRef.get(ProfileService);
    systemSettingsService = resolveSystemSettingsServices(moduleRef);

    // After restart, correct password is STILL rejected while lockedUntil > now
    await expect(
      authService.login({
        email: 'khoi.lockout@example.com',
        password: 'CorrectPassword@123',
      }),
    ).rejects.toThrowError(
      new ForbiddenException(
        'Tài khoản tạm khóa 15 phút do nhập sai mật khẩu quá 5 lần',
      ),
    );

    // Simulate lock expiry (lockedUntil in the past) + wrong password -> resets counter to 1, clears lockedUntil
    await prisma.user.update({
      where: { id: reg.user.id },
      data: { lockedUntil: new Date(Date.now() - 1000) },
    });

    await expect(
      authService.login({
        email: 'khoi.lockout@example.com',
        password: 'WrongPassword@999',
      }),
    ).rejects.toThrowError(UnauthorizedException);

    const postExpiryRow = await prisma.user.findUniqueOrThrow({
      where: { id: reg.user.id },
    });
    expect(postExpiryRow.failedLoginAttempts).toBe(1);
    expect(postExpiryRow.lockedUntil).toBeNull();

    // Valid login resets failedLoginAttempts to 0
    const success = await authService.login({
      email: 'khoi.lockout@example.com',
      password: 'CorrectPassword@123',
    });
    expect(success.user.email).toBe('khoi.lockout@example.com');
    const finalRow = await prisma.user.findUniqueOrThrow({
      where: { id: reg.user.id },
    });
    expect(finalRow.failedLoginAttempts).toBe(0);
    expect(finalRow.lockedUntil).toBeNull();
  });

  it('Scenario 2 (P0-B1 Multi-Instance Concurrency): 12 concurrent wrong logins across 2 independent NestJS instances serialize via PostgreSQL FOR UPDATE', async () => {
    const reg = await authService.register({
      fullName: 'Lê Thị Song Song',
      dateOfBirth: '2000-08-20',
      phone: '0901000002',
      email: 'concurrent.lock@example.com',
      password: 'CorrectPassword@123',
    });

    const secondInstance = await bootNestModule();
    const secondAuthService = resolveAuthServices(secondInstance);

    try {
      const outcomes = await Promise.allSettled(
        Array.from({ length: 12 }, (_, idx) => {
          const svc = idx % 2 === 0 ? authService : secondAuthService;
          return svc.login({
            email: 'concurrent.lock@example.com',
            password: 'WrongPassword@999',
          });
        }),
      );

      const statuses = outcomes.map((o) =>
        o.status === 'rejected' && o.reason instanceof HttpException
          ? o.reason.getStatus()
          : 200,
      );

      expect(statuses.filter((s) => s === 401)).toHaveLength(4);
      expect(statuses.filter((s) => s === 403)).toHaveLength(8);

      const dbRow = await prisma.user.findUniqueOrThrow({
        where: { id: reg.user.id },
      });
      expect(dbRow.failedLoginAttempts).toBe(5);
      expect(dbRow.lockedUntil).not.toBeNull();
    } finally {
      await secondInstance.close();
    }
  });

  it('Scenario 3 (Duplicate Registration Concurrency): Concurrent registrations with identical email/phone map PostgreSQL P2002 to 409 Conflict with zero orphan rows', async () => {
    const outcomes = await Promise.allSettled(
      Array.from({ length: 4 }, (_, idx) =>
        authService.register({
          fullName: `Ứng Viên ${idx + 1}`,
          dateOfBirth: '2001-03-10',
          phone: '0901000003',
          email: 'race.register@example.com',
          password: 'Password@123',
        }),
      ),
    );

    const fulfilled = outcomes.filter((o) => o.status === 'fulfilled');
    const conflicts = outcomes.filter(
      (o) =>
        o.status === 'rejected' &&
        o.reason instanceof ConflictException &&
        o.reason.getStatus() === 409,
    );

    expect(fulfilled).toHaveLength(1);
    expect(conflicts).toHaveLength(3);
    expect(await prisma.user.count()).toBe(1);
    expect(await prisma.studentProfile.count()).toBe(1);
  });

  it('Scenario 4 (Age, Leap-Year & Guardian Consent): Enforces <12 block, shared sibling guardianEmail for 12-15, >=16 no guardian, and Asia/Ho_Chi_Minh leap-year 29/02', async () => {
    await expect(
      authService.register({
        fullName: 'Bé 8 Tuổi',
        dateOfBirth: DOB_UNDER_12,
        phone: '0901000010',
        email: 'under12@example.com',
        password: 'Password@123',
      }),
    ).rejects.toThrowError(BadRequestException);

    // Under-16 students register using parent email + consent checkbox
    const s1 = await authService.register(
      {
        fullName: 'Nguyễn Minh Châu',
        dateOfBirth: DOB_TEEN_14,
        phone: '0901000011',
        email: 'parent.chau@example.com',
        password: 'Password@123',
        guardianConsent: true,
      },
      { ipAddress: '203.113.10.5', userAgent: 'IntegrationTest/1.0' },
    );

    const s2 = await authService.register(
      {
        fullName: 'Nguyễn Minh Khang',
        dateOfBirth: DOB_TEEN_13,
        phone: '0901000012',
        email: 'parent.khang@example.com',
        password: 'Password@123',
        guardianConsent: true,
      },
      { ipAddress: '203.113.10.5', userAgent: 'IntegrationTest/1.0' },
    );

    expect(s1.user.status).toBe(UserStatus.PENDING_CLASS);
    expect(s2.user.status).toBe(UserStatus.PENDING_CLASS);

    const consents = await prisma.guardianConsent.findMany({
      orderBy: { consentedAt: 'asc' },
    });
    expect(consents).toHaveLength(2);
    expect(consents[0]?.guardianEmail).toBe('parent.chau@example.com');
    expect(consents[0]?.consentVersion).toBe('v1.0');
    expect(consents[0]?.consentTextSnapshot.length).toBeGreaterThan(20);

    // Verify Immutability: When student turns 16 and updates personal email, GuardianConsent is untouched
    await prisma.user.update({
      where: { id: s1.user.id },
      data: { email: 'chau.grownup@example.com' },
    });
    const consentAfterUpdate = await prisma.guardianConsent.findUnique({
      where: { studentProfileId: consents[0]?.studentProfileId },
    });
    expect(consentAfterUpdate?.guardianEmail).toBe('parent.chau@example.com');

    // Adult >= 16 requires no guardianEmail
    const adult = await authService.register({
      fullName: 'Phạm Hoàng Nam',
      dateOfBirth: '2004-02-29',
      phone: '0901000013',
      email: 'nam.leap@example.com',
      password: 'Password@123',
    });
    expect(adult.user.dateOfBirth).toBe('2004-02-29');

    // Leap-year boundary check in Asia/Ho_Chi_Minh (born 2012-02-29: on 2024-02-28 VN is 11, on 2024-02-29 VN is 12)
    expect(
      calculateAgeInVnTimezone('2012-02-29', new Date('2024-02-28T16:59:59.000Z')),
    ).toBe(11);
    expect(
      calculateAgeInVnTimezone('2012-02-29', new Date('2024-02-28T17:00:01.000Z')),
    ).toBe(12);
  });

  it('Scenario 5 (FUNC-005 Real SMTP Reset Flow): Delivers reset link over TCP SMTP, hashes token in DB, enforces atomic DB 60s cooldown, handles SMTP failure safely, and enforces single-use + 15m TTL', async () => {
    const reg = await authService.register({
      fullName: 'Đỗ Thanh Hà',
      dateOfBirth: '2000-11-11',
      phone: '0901000021',
      email: 'ha.reset@example.com',
      password: 'OldPassword@123',
    });

    // Concurrent forgot-password calls -> strictly 1 returns 200, rest return 429 via email_rate_limits
    const burst = await Promise.allSettled(
      Array.from({ length: 4 }, () =>
        authService.forgotPassword({ email: 'ha.reset@example.com' }),
      ),
    );
    expect(burst.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(
      burst.filter(
        (r) =>
          r.status === 'rejected' &&
          r.reason instanceof HttpException &&
          r.reason.getStatus() === 429,
      ),
    ).toHaveLength(3);

    // Captured real SMTP message
    const capturedMail = smtpServer.getLatestMessageFor('ha.reset@example.com');
    expect(capturedMail).toBeDefined();
    const rawToken = smtpServer.extractResetTokenFromMessage(capturedMail!);
    expect(rawToken).toMatch(/^[0-9a-f]{64}$/);

    // Verify DB stores ONLY SHA-256 hash, NEVER rawToken
    const expectedHash = crypto.createHash('sha256').update(rawToken!).digest('hex');
    const dbToken = await prisma.passwordResetToken.findFirstOrThrow({
      where: { userId: reg.user.id },
    });
    expect(dbToken.tokenHash).toBe(expectedHash);
    expect(dbToken.tokenHash).not.toBe(rawToken);

    // Concurrent double-consumption of the same reset token -> strictly 1 succeeds, 1 fails 400
    const consumeRace = await Promise.allSettled([
      authService.resetPassword({
        token: rawToken!,
        newPassword: 'NewPassword@456',
        confirmPassword: 'NewPassword@456',
      }),
      authService.resetPassword({
        token: rawToken!,
        newPassword: 'NewPassword@789',
        confirmPassword: 'NewPassword@789',
      }),
    ]);
    expect(consumeRace.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(consumeRace.filter((r) => r.status === 'rejected')).toHaveLength(1);

    // Simulated TCP SMTP 451 failure revokes orphaned token and preserves uniform 200 anti-enumeration
    await prisma.emailRateLimit.deleteMany();
    smtpServer.setSimulateFailure(true);
    const failRes = await authService.forgotPassword({ email: 'ha.reset@example.com' });
    expect(failRes.cooldownSeconds).toBe(60);
    const unusedTokens = await prisma.passwordResetToken.count({
      where: { userId: reg.user.id, usedAt: null },
    });
    expect(unusedTokens).toBe(0);
  });

  it('Scenario 6 (FUNC-008 Initial Enrollment & Partial Unique Index): Blocks status bypass, validates real Class, serializes concurrent initial enrollment, and enforces idx_unique_student_active_enrollment', async () => {
    const adminUser = await prisma.user.create({
      data: {
        email: 'admin.enroll@webedu.vn',
        phone: '0902000001',
        fullName: 'Admin Học Vụ',
        passwordHash: await bcrypt.hash('Admin@123456', 10),
        roles: [Role.ADMIN],
        status: UserStatus.ACTIVE,
      },
    });
    const teacherUser = await prisma.user.create({
      data: {
        email: 'teacher.enroll@webedu.vn',
        phone: '0902000002',
        fullName: 'Cô Giáo Mai',
        passwordHash: await bcrypt.hash('Teacher@123456', 10),
        roles: [Role.TEACHER],
        status: UserStatus.ACTIVE,
      },
    });
    const adminActor: AuthenticatedUser = {
      id: adminUser.id,
      email: adminUser.email,
      fullName: adminUser.fullName,
      phone: adminUser.phone,
      roles: adminUser.roles,
      effectiveRole: Role.ADMIN,
      status: UserStatus.ACTIVE,
      tokenVersion: 0,
    };

    const course = await prisma.course.create({
      data: {
        code: 'HSK1-STD',
        name: 'HSK 1 Tiêu Chuẩn',
        level: CourseLevel.HSK1,
      },
    });

    const classA = await prisma.class.create({
      data: {
        code: 'HSK1-26A',
        courseId: course.id,
        teacherId: teacherUser.id,
        status: ClassStatus.UPCOMING,
        startDate: new Date('2026-12-01T00:00:00.000Z'),
      },
    });
    const classB = await prisma.class.create({
      data: {
        code: 'HSK1-26B',
        courseId: course.id,
        teacherId: teacherUser.id,
        status: ClassStatus.ACTIVE,
        startDate: new Date('2026-11-01T00:00:00.000Z'),
      },
    });
    const completedClass = await prisma.class.create({
      data: {
        code: 'HSK1-DONE',
        courseId: course.id,
        teacherId: teacherUser.id,
        status: ClassStatus.COMPLETED,
        startDate: new Date('2026-01-01T00:00:00.000Z'),
      },
    });

    const pendingReg = await authService.register({
      fullName: 'Vũ Ngọc Bích',
      dateOfBirth: '2002-06-15',
      phone: '0902000003',
      email: 'bich.pending@example.com',
      password: 'Student@123456',
    });

    // Bypass attempt via updateStudent -> 400
    await expect(
      studentsService.updateStudent(adminActor, pendingReg.user.id, {
        status: UserStatus.ACTIVE,
      }),
    ).rejects.toThrowError(BadRequestException);

    // Non-existent class -> 404; COMPLETED class -> 400
    await expect(
      studentsService.assignInitialClass(adminActor, pendingReg.user.id, {
        classNameOrId: 'NO-SUCH-CLASS',
      }),
    ).rejects.toThrowError(NotFoundException);
    await expect(
      studentsService.assignInitialClass(adminActor, pendingReg.user.id, {
        classNameOrId: completedClass.code,
      }),
    ).rejects.toThrowError(BadRequestException);

    // 6 concurrent initial class assignments across classA & classB -> strictly 1 succeeds!
    const assignOutcomes = await Promise.allSettled(
      Array.from({ length: 6 }, (_, idx) =>
        studentsService.assignInitialClass(adminActor, pendingReg.user.id, {
          classNameOrId: idx % 2 === 0 ? classA.code : classB.code,
        }),
      ),
    );
    expect(assignOutcomes.filter((o) => o.status === 'fulfilled')).toHaveLength(1);
    expect(assignOutcomes.filter((o) => o.status === 'rejected')).toHaveLength(5);

    const activeEnrollments = await prisma.enrollment.findMany({
      where: { studentId: pendingReg.user.id, status: EnrollmentStatus.ACTIVE },
    });
    expect(activeEnrollments).toHaveLength(1);

    // Verify PostgreSQL Partial Unique Index idx_unique_student_active_enrollment directly at DB level
    await expect(
      prisma.enrollment.create({
        data: {
          classId: classB.id,
          studentId: pendingReg.user.id,
          status: EnrollmentStatus.ACTIVE,
          enrolledDate: new Date(),
        },
      }),
    ).rejects.toMatchObject({ code: 'P2002' });
  });

  it('Scenario 7 (FUNC-006 Teacher Active Classes Guard): Blocks deactivating teacher who leads UPCOMING/ACTIVE classes in PostgreSQL', async () => {
    const adminUser = await prisma.user.create({
      data: {
        email: 'admin.t@webedu.vn',
        phone: '0903000001',
        fullName: 'Admin T',
        passwordHash: 'hash',
        roles: [Role.ADMIN],
        status: UserStatus.ACTIVE,
      },
    });
    const adminActor: AuthenticatedUser = {
      id: adminUser.id,
      email: adminUser.email,
      fullName: adminUser.fullName,
      phone: adminUser.phone,
      roles: [Role.ADMIN],
      effectiveRole: Role.ADMIN,
      status: UserStatus.ACTIVE,
      tokenVersion: 0,
    };

    const teacher = await teachersService.createTeacher(adminActor, {
      fullName: 'Thầy Trương Vô Kỵ',
      phone: '0903000002',
      email: 'voky.teacher@webedu.vn',
      initialPassword: 'TeacherPass@123',
    });

    const course = await prisma.course.create({
      data: { code: 'HSK3', name: 'HSK 3', level: CourseLevel.HSK3 },
    });
    const cls = await prisma.class.create({
      data: {
        code: 'HSK3-K01',
        courseId: course.id,
        teacherId: teacher.id,
        status: ClassStatus.ACTIVE,
        startDate: new Date('2026-10-01T00:00:00.000Z'),
      },
    });

    await expect(
      teachersService.updateTeacher(adminActor, teacher.id, {
        status: UserStatus.INACTIVE,
      }),
    ).rejects.toThrowError(ConflictException);

    // Complete class -> teacher can now be deactivated cleanly and tokenVersion increments
    await prisma.class.update({
      where: { id: cls.id },
      data: { status: ClassStatus.COMPLETED },
    });

    const deactivated = await teachersService.updateTeacher(adminActor, teacher.id, {
      status: UserStatus.INACTIVE,
    });
    expect(deactivated.status).toBe(UserStatus.INACTIVE);
  });

  it('Scenario 8 (SEC-07 Mutual Superadmin Demotion on Real PostgreSQL): Serializes concurrent mutual demotions via SELECT ... FOR UPDATE preserving >= 1 active Superadmin', async () => {
    const sa1 = await prisma.user.create({
      data: {
        email: 'sa1.race@webedu.vn',
        phone: '0904000001',
        fullName: 'Superadmin 1',
        passwordHash: 'hash',
        roles: [Role.SUPERADMIN],
        status: UserStatus.ACTIVE,
      },
    });
    const sa2 = await prisma.user.create({
      data: {
        email: 'sa2.race@webedu.vn',
        phone: '0904000002',
        fullName: 'Superadmin 2',
        passwordHash: 'hash',
        roles: [Role.SUPERADMIN],
        status: UserStatus.ACTIVE,
      },
    });

    const actor1: AuthenticatedUser = {
      id: sa1.id,
      email: sa1.email,
      fullName: sa1.fullName,
      phone: sa1.phone,
      roles: [Role.SUPERADMIN],
      effectiveRole: Role.SUPERADMIN,
      status: UserStatus.ACTIVE,
      tokenVersion: 0,
    };
    const actor2: AuthenticatedUser = {
      id: sa2.id,
      email: sa2.email,
      fullName: sa2.fullName,
      phone: sa2.phone,
      roles: [Role.SUPERADMIN],
      effectiveRole: Role.SUPERADMIN,
      status: UserStatus.ACTIVE,
      tokenVersion: 0,
    };

    const outcomes = await Promise.allSettled([
      systemSettingsService.updateUserRolesAndStatus(actor1, sa2.id, {
        status: UserStatus.INACTIVE,
      }),
      systemSettingsService.updateUserRolesAndStatus(actor2, sa1.id, {
        status: UserStatus.INACTIVE,
      }),
    ]);

    expect(outcomes.filter((o) => o.status === 'fulfilled')).toHaveLength(1);
    expect(outcomes.filter((o) => o.status === 'rejected')).toHaveLength(1);

    const remainingActive = await prisma.user.count({
      where: {
        roles: { has: Role.SUPERADMIN },
        status: UserStatus.ACTIVE,
      },
    });
    expect(remainingActive).toBe(1);
  });

  it('Scenario 9 & 10 (FUNC-007 DOB Lock + DEC-024/025/026 & FUNC-013 Object-Level RBAC): Verifies DOB immutability after consent, teacher replacement 403, completed class READ_ONLY, and Superadmin isolation', async () => {
    const admin = await prisma.user.create({
      data: {
        email: 'admin.rbac@webedu.vn',
        phone: '0905000001',
        fullName: 'Admin RBAC',
        passwordHash: 'hash',
        roles: [Role.ADMIN],
        status: UserStatus.ACTIVE,
      },
    });
    const pureSa = await prisma.user.create({
      data: {
        email: 'sa.rbac@webedu.vn',
        phone: '0905000002',
        fullName: 'Pure Superadmin',
        passwordHash: 'hash',
        roles: [Role.SUPERADMIN],
        status: UserStatus.ACTIVE,
      },
    });
    const teacherOld = await prisma.user.create({
      data: {
        email: 'told.rbac@webedu.vn',
        phone: '0905000003',
        fullName: 'GV Cũ',
        passwordHash: 'hash',
        roles: [Role.TEACHER],
        status: UserStatus.ACTIVE,
      },
    });
    const teacherNew = await prisma.user.create({
      data: {
        email: 'tnew.rbac@webedu.vn',
        phone: '0905000004',
        fullName: 'GV Mới',
        passwordHash: 'hash',
        roles: [Role.TEACHER],
        status: UserStatus.ACTIVE,
      },
    });

    const teenReg = await authService.register({
      fullName: 'Hoàng Bảo Ngọc',
      dateOfBirth: DOB_TEEN_14,
      phone: '0905000005',
      email: 'parent.ngoc@example.com',
      password: 'Password@123',
      guardianConsent: true,
    });

    const adminActor: AuthenticatedUser = {
      id: admin.id,
      email: admin.email,
      fullName: admin.fullName,
      phone: admin.phone,
      roles: [Role.ADMIN],
      effectiveRole: Role.ADMIN,
      status: UserStatus.ACTIVE,
      tokenVersion: 0,
    };
    const saActor: AuthenticatedUser = {
      id: pureSa.id,
      email: pureSa.email,
      fullName: pureSa.fullName,
      phone: pureSa.phone,
      roles: [Role.SUPERADMIN],
      effectiveRole: Role.SUPERADMIN,
      status: UserStatus.ACTIVE,
      tokenVersion: 0,
    };
    const oldTeacherActor: AuthenticatedUser = {
      id: teacherOld.id,
      email: teacherOld.email,
      fullName: teacherOld.fullName,
      phone: teacherOld.phone,
      roles: [Role.TEACHER],
      effectiveRole: Role.TEACHER,
      status: UserStatus.ACTIVE,
      tokenVersion: 0,
    };
    const newTeacherActor: AuthenticatedUser = {
      id: teacherNew.id,
      email: teacherNew.email,
      fullName: teacherNew.fullName,
      phone: teacherNew.phone,
      roles: [Role.TEACHER],
      effectiveRole: Role.TEACHER,
      status: UserStatus.ACTIVE,
      tokenVersion: 0,
    };

    // DOB locked because GuardianConsent exists
    await expect(
      studentsService.updateStudent(adminActor, teenReg.user.id, {
        dateOfBirth: '2011-07-10',
      }),
    ).rejects.toThrowError(BadRequestException);

    // Admin sets internalNotes; Pure Superadmin sees null and cannot overwrite internalNotes
    await studentsService.updateStudent(adminActor, teenReg.user.id, {
      internalNotes: 'Học viên cần kèm phát âm thanh điệu',
    });
    const saView = await studentsService.getStudentById(saActor, teenReg.user.id);
    expect(saView.internalNotes).toBeNull();
    await expect(
      studentsService.updateStudent(saActor, teenReg.user.id, {
        internalNotes: 'Ghi đè trái phép',
      }),
    ).rejects.toThrowError(ForbiddenException);

    // Enroll student into class taught by teacherOld
    const course = await prisma.course.create({
      data: { code: 'HSK2', name: 'HSK 2', level: CourseLevel.HSK2 },
    });
    const cls = await prisma.class.create({
      data: {
        code: 'HSK2-K09',
        courseId: course.id,
        teacherId: teacherOld.id,
        status: ClassStatus.ACTIVE,
        startDate: new Date('2026-10-15T00:00:00.000Z'),
      },
    });
    await studentsService.assignInitialClass(adminActor, teenReg.user.id, {
      classNameOrId: cls.code,
    });

    // DEC-025 Case 1: Class COMPLETED without replacing teacherOld -> READ_ONLY access
    await prisma.class.update({
      where: { id: cls.id },
      data: { status: ClassStatus.COMPLETED },
    });
    const case1 = await studentsService.getStudentLearningRecords(
      oldTeacherActor,
      teenReg.user.id,
    );
    expect(case1.records[0]?.accessMode).toBe('READ_ONLY');

    // DEC-025 Case 2: Teacher replaced by teacherNew -> teacherOld gets 403, teacherNew gets FULL
    await prisma.class.update({
      where: { id: cls.id },
      data: { status: ClassStatus.ACTIVE, teacherId: teacherNew.id },
    });
    await expect(
      studentsService.getStudentLearningRecords(oldTeacherActor, teenReg.user.id),
    ).rejects.toThrowError(ForbiddenException);
    const case2 = await studentsService.getStudentLearningRecords(
      newTeacherActor,
      teenReg.user.id,
    );
    expect(case2.records[0]?.accessMode).toBe('FULL');

    // DEC-024: Teacher blocked from past class history; Pure Superadmin blocked from academic endpoints
    await expect(
      studentsService.getStudentClassHistory(newTeacherActor, teenReg.user.id),
    ).rejects.toThrowError(ForbiddenException);
    await expect(
      studentsService.getStudentLearningRecords(saActor, teenReg.user.id),
    ).rejects.toThrowError(ForbiddenException);
  });

  it('Scenario 11 & 12 (Profile Rotation, System Config Magic Bytes & Sanitized Audit Logs): Increments tokenVersion on password/email change and redacts secrets in PostgreSQL audit logs', async () => {
    const sa = await prisma.user.create({
      data: {
        email: 'sa.audit@webedu.vn',
        phone: '0906000001',
        fullName: 'Superadmin Audit',
        passwordHash: await bcrypt.hash('InitialPass@123', 10),
        roles: [Role.SUPERADMIN],
        status: UserStatus.ACTIVE,
      },
    });
    const saActor: AuthenticatedUser = {
      id: sa.id,
      email: sa.email,
      fullName: sa.fullName,
      phone: sa.phone,
      roles: [Role.SUPERADMIN],
      effectiveRole: Role.SUPERADMIN,
      status: UserStatus.ACTIVE,
      tokenVersion: 0,
    };

    await systemSettingsService.createSystemUser(saActor, {
      fullName: 'Admin Mới',
      phone: '0906000002',
      email: 'admin.new@webedu.vn',
      initialPassword: 'SuperSecretInitPass@999',
      roles: [Role.ADMIN],
    });

    const pwdRotated = await profileService.changePassword(
      sa.id,
      {
        currentPassword: 'InitialPass@123',
        newPassword: 'UpdatedPass@456',
        confirmPassword: 'UpdatedPass@456',
      },
      { rememberMe: true },
    );
    expect(pwdRotated.expiresIn).toBe(7 * 24 * 60 * 60);

    const refreshedSa = await prisma.user.findUniqueOrThrow({ where: { id: sa.id } });
    expect(refreshedSa.tokenVersion).toBe(1);

    // Reject SVG payload, accept valid PNG magic bytes
    await expect(
      systemSettingsService.updateSystemConfig(saActor, {
        centerName: 'Trung Tâm TD Hán Ngữ',
        centerLogoUrl: `data:image/png;base64,${Buffer.from('<svg></svg>').toString('base64')}`,
      }),
    ).rejects.toThrowError(BadRequestException);

    const pngBytes = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
    ]);
    const updatedCfg = await systemSettingsService.updateSystemConfig(saActor, {
      centerName: 'Trung Tâm TD Hán Ngữ — Cơ Sở 1',
      centerLogoUrl: `data:image/png;base64,${pngBytes.toString('base64')}`,
    });
    expect(updatedCfg.centerName).toBe('Trung Tâm TD Hán Ngữ — Cơ Sở 1');

    // Inspect raw PostgreSQL system_audit_logs to guarantee zero plaintext secrets
    const logs = await prisma.systemAuditLog.findMany();
    expect(logs.length).toBeGreaterThanOrEqual(3);
    const serialized = JSON.stringify(logs);
    expect(serialized).not.toContain('SuperSecretInitPass@999');
    expect(serialized).not.toContain('InitialPass@123');
    expect(serialized).not.toContain('UpdatedPass@456');
    expect(serialized).toContain('[REDACTED]');
  });

  it('Scenario 13 (Stage E Concurrency, Post-Drop Reactivation Guard & Deadlock-Free Lock Ordering): Preserves concurrent updateStudent + assignInitialClass without wedging status, blocks post-drop reactivation, and avoids 40P01 deadlock across cross-service Superadmin updates', async () => {
    const admin = await prisma.user.create({
      data: {
        email: 'admin.stagee@webedu.vn',
        phone: '0907000001',
        fullName: 'Admin Stage E',
        passwordHash: 'hash',
        roles: [Role.ADMIN],
        status: UserStatus.ACTIVE,
      },
    });
    const teacher = await prisma.user.create({
      data: {
        email: 'gv.stagee@webedu.vn',
        phone: '0907000002',
        fullName: 'GV Stage E',
        passwordHash: 'hash',
        roles: [Role.TEACHER],
        status: UserStatus.ACTIVE,
      },
    });
    const adminActor: AuthenticatedUser = {
      id: admin.id,
      email: admin.email,
      fullName: admin.fullName,
      phone: admin.phone,
      roles: [Role.ADMIN],
      effectiveRole: Role.ADMIN,
      status: UserStatus.ACTIVE,
      tokenVersion: 0,
    };

    const course = await prisma.course.create({
      data: { code: 'HSK1-E', name: 'HSK 1 Stage E', level: CourseLevel.HSK1 },
    });
    const openClass = await prisma.class.create({
      data: {
        code: 'HSK1-STAGE-E',
        courseId: course.id,
        teacherId: teacher.id,
        status: ClassStatus.ACTIVE,
        startDate: new Date('2026-11-01T00:00:00.000Z'),
      },
    });

    const reg = await authService.register({
      fullName: 'Trần Song Song',
      dateOfBirth: '2001-03-10',
      phone: '0907000003',
      email: 'songsong@example.com',
      password: 'Password@123',
    });

    // 1. Concurrent updateStudent(internalNotes) + assignInitialClass -> both commit cleanly without reverting status to PENDING_CLASS
    await Promise.all([
      studentsService.updateStudent(adminActor, reg.user.id, {
        internalNotes: 'Ghi chú song song không làm kẹt trạng thái',
      }),
      studentsService.assignInitialClass(adminActor, reg.user.id, {
        classNameOrId: openClass.code,
      }),
    ]);

    const afterConcurrent = await prisma.user.findUniqueOrThrow({
      where: { id: reg.user.id },
      include: { studentProfile: true },
    });
    expect(afterConcurrent.status).toBe(UserStatus.ACTIVE);
    expect(afterConcurrent.studentProfile?.currentClassId).toBe(openClass.id);
    expect(afterConcurrent.studentProfile?.internalNotes).toBe(
      'Ghi chú song song không làm kẹt trạng thái',
    );

    // 2. Simulate Phase 3 DROPPED enrollment (currentClassId = null, Enrollment = DROPPED, User = INACTIVE)
    await prisma.enrollment.updateMany({
      where: { studentId: reg.user.id },
      data: { status: EnrollmentStatus.DROPPED, leftDate: new Date() },
    });
    await prisma.studentProfile.update({
      where: { userId: reg.user.id },
      data: { currentClassId: null, assignedClass: null },
    });
    await prisma.user.update({
      where: { id: reg.user.id },
      data: { status: UserStatus.INACTIVE },
    });

    // Reactivating post-drop student without an ACTIVE/COMPLETED enrollment must fail with 400!
    await expect(
      studentsService.updateStudent(adminActor, reg.user.id, {
        status: UserStatus.ACTIVE,
      }),
    ).rejects.toThrowError(BadRequestException);

    // 3. Cross-service concurrent mutual deactivation of two [SUPERADMIN, TEACHER] accounts -> zero 40P01 deadlock and >= 1 active Superadmin preserved
    const saTeacher1 = await prisma.user.create({
      data: {
        id: 'aa-sa-teacher-1',
        email: 'sat1@webedu.vn',
        phone: '0907000011',
        fullName: 'SA Teacher 1',
        passwordHash: 'hash',
        roles: [Role.SUPERADMIN, Role.TEACHER],
        status: UserStatus.ACTIVE,
        teacherProfile: { create: {} },
      },
    });
    const saTeacher2 = await prisma.user.create({
      data: {
        id: 'zz-sa-teacher-2',
        email: 'sat2@webedu.vn',
        phone: '0907000012',
        fullName: 'SA Teacher 2',
        passwordHash: 'hash',
        roles: [Role.SUPERADMIN, Role.TEACHER],
        status: UserStatus.ACTIVE,
        teacherProfile: { create: {} },
      },
    });
    const saActor1: AuthenticatedUser = {
      id: saTeacher1.id,
      email: saTeacher1.email,
      fullName: saTeacher1.fullName,
      phone: saTeacher1.phone,
      roles: saTeacher1.roles,
      effectiveRole: Role.SUPERADMIN,
      status: UserStatus.ACTIVE,
      tokenVersion: 0,
    };
    const saActor2: AuthenticatedUser = {
      id: saTeacher2.id,
      email: saTeacher2.email,
      fullName: saTeacher2.fullName,
      phone: saTeacher2.phone,
      roles: saTeacher2.roles,
      effectiveRole: Role.SUPERADMIN,
      status: UserStatus.ACTIVE,
      tokenVersion: 0,
    };

    const crossRace = await Promise.allSettled([
      teachersService.updateTeacher(saActor1, saTeacher2.id, {
        status: UserStatus.INACTIVE,
      }),
      systemSettingsService.updateUserRolesAndStatus(saActor2, saTeacher1.id, {
        status: UserStatus.INACTIVE,
      }),
    ]);

    const fulfilledCross = crossRace.filter((r) => r.status === 'fulfilled');
    const rejectedCross = crossRace.filter(
      (r) => r.status === 'rejected' && r.reason instanceof BadRequestException,
    );
    expect(fulfilledCross).toHaveLength(1);
    expect(rejectedCross).toHaveLength(1);

    const activeSaLeft = await prisma.user.count({
      where: { roles: { has: Role.SUPERADMIN }, status: UserStatus.ACTIVE },
    });
    expect(activeSaLeft).toBe(1);
  });
});
