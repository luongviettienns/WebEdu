import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import bcrypt from 'bcryptjs';
import { Role, UserStatus } from '@prisma/client';
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

interface LoginRespBody {
  accessToken: string;
}

interface ProblemBody {
  status: number;
  detail: string;
}

describe('RBAC, Multi-Tenant IDOR & Superadmin Isolation (e2e — Slice 2.4)', () => {
  let app: INestApplication<App>;
  let fakePrisma: InMemoryPrismaService;

  const PASSWORD = 'TestPassword@123';
  let passwordHash: string;

  const IDS = {
    studentA: 'u-student-a',
    studentB: 'u-student-b',
    teacher: 'u-teacher-1',
    admin: 'u-admin-1',
    superadmin1: 'u-sa-1',
    superadmin2: 'u-sa-2',
    saTeacher: 'u-sa-teacher',
    saStudent: 'u-sa-student',
    teacherStudent: 'u-teacher-student',
  };

  async function loginAs(email: string): Promise<string> {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password: PASSWORD })
      .expect(200);
    return (res.body as LoginRespBody).accessToken;
  }

  beforeEach(async () => {
    fakePrisma = new InMemoryPrismaService();
    passwordHash = await bcrypt.hash(PASSWORD, 10);

    // Seed Student A & Student B
    await fakePrisma.user.create({
      data: {
        id: IDS.studentA,
        email: 'student.a@webedu.vn',
        phone: '0910000001',
        fullName: 'Học Viên A',
        passwordHash,
        roles: [Role.STUDENT],
        status: UserStatus.ACTIVE,
      },
    });
    await fakePrisma.studentProfile.create({
      data: {
        userId: IDS.studentA,
        dateOfBirth: new Date('2006-05-10T00:00:00.000Z'),
        assignedClass: 'HSK2-K01',
      },
    });

    await fakePrisma.user.create({
      data: {
        id: IDS.studentB,
        email: 'student.b@webedu.vn',
        phone: '0910000002',
        fullName: 'Học Viên B',
        passwordHash,
        roles: [Role.STUDENT],
        status: UserStatus.ACTIVE,
      },
    });
    await fakePrisma.studentProfile.create({
      data: {
        userId: IDS.studentB,
        dateOfBirth: new Date('2005-08-20T00:00:00.000Z'),
        assignedClass: 'HSK3-K05',
      },
    });

    // Seed Teacher
    await fakePrisma.user.create({
      data: {
        id: IDS.teacher,
        email: 'teacher.1@webedu.vn',
        phone: '0910000003',
        fullName: 'Giáo Viên 1',
        passwordHash,
        roles: [Role.TEACHER],
        status: UserStatus.ACTIVE,
      },
    });
    await fakePrisma.teacherProfile.create({
      data: {
        userId: IDS.teacher,
        activeClassesCount: 1,
      },
    });

    // Seed Admin
    await fakePrisma.user.create({
      data: {
        id: IDS.admin,
        email: 'admin.1@webedu.vn',
        phone: '0910000004',
        fullName: 'Quản Trị Đào Tạo',
        passwordHash,
        roles: [Role.ADMIN],
        status: UserStatus.ACTIVE,
      },
    });

    // Seed Pure Superadmin 1 & Superadmin 2
    await fakePrisma.user.create({
      data: {
        id: IDS.superadmin1,
        email: 'sa.1@webedu.vn',
        phone: '0910000005',
        fullName: 'Superadmin 1',
        passwordHash,
        roles: [Role.SUPERADMIN],
        status: UserStatus.ACTIVE,
      },
    });

    await fakePrisma.user.create({
      data: {
        id: IDS.superadmin2,
        email: 'sa.2@webedu.vn',
        phone: '0910000006',
        fullName: 'Superadmin 2',
        passwordHash,
        roles: [Role.SUPERADMIN],
        status: UserStatus.ACTIVE,
      },
    });

    // Seed Dual-role Superadmin + Teacher (to test SEC-08 Admin cannot touch Superadmin teacher)
    await fakePrisma.user.create({
      data: {
        id: IDS.saTeacher,
        email: 'sa.teacher@webedu.vn',
        phone: '0910000007',
        fullName: 'Superadmin Kiêm GV',
        passwordHash,
        roles: [Role.TEACHER, Role.SUPERADMIN],
        status: UserStatus.ACTIVE,
      },
    });
    await fakePrisma.teacherProfile.create({
      data: {
        userId: IDS.saTeacher,
        activeClassesCount: 0,
      },
    });

    // Seed Dual-role Superadmin + Student (to test multi-role RBAC & SEC-08 on /students)
    await fakePrisma.user.create({
      data: {
        id: IDS.saStudent,
        email: 'sa.student@webedu.vn',
        phone: '0910000008',
        fullName: 'Superadmin Kiêm HV',
        passwordHash,
        roles: [Role.SUPERADMIN, Role.STUDENT],
        status: UserStatus.ACTIVE,
      },
    });
    await fakePrisma.studentProfile.create({
      data: {
        userId: IDS.saStudent,
        dateOfBirth: new Date('2002-01-10T00:00:00.000Z'),
        assignedClass: 'HSK4-K01',
        internalNotes: 'Ghi chú mật SA-HV',
      },
    });

    // Seed Dual-role Teacher + Student (to test multi-role IDOR & internalNotes masking)
    await fakePrisma.user.create({
      data: {
        id: IDS.teacherStudent,
        email: 'teacher.student@webedu.vn',
        phone: '0910000009',
        fullName: 'GV Kiêm Học Viên',
        passwordHash,
        roles: [Role.TEACHER, Role.STUDENT],
        status: UserStatus.ACTIVE,
      },
    });
    await fakePrisma.studentProfile.create({
      data: {
        userId: IDS.teacherStudent,
        dateOfBirth: new Date('2001-03-15T00:00:00.000Z'),
        assignedClass: 'HSK5-K02',
        internalNotes: 'Ghi chú nội bộ nhạy cảm của Admin',
      },
    });

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

  it('Cross-account / IDOR Guard: Student A gets 403 on Student B endpoints and Student B data stays intact, while own resources return 200 (FUNC-010)', async () => {
    const tokenA = await loginAs('student.a@webedu.vn');

    // Student A attempts GET /students/:studentBId -> 403
    await request(app.getHttpServer())
      .get(`/api/v1/students/${IDS.studentB}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(403);

    // Student A attempts PATCH /students/:studentBId -> 403 and Student B fullName unchanged
    await request(app.getHttpServer())
      .patch(`/api/v1/students/${IDS.studentB}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ fullName: 'Hacked By Student A' })
      .expect(403);

    expect(fakePrisma.users.get(IDS.studentB)?.fullName).toBe('Học Viên B');

    // Student A attempts GET /students/:studentBId/learning-records -> 403
    await request(app.getHttpServer())
      .get(`/api/v1/students/${IDS.studentB}/learning-records`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(403);

    // Student A attempts GET /students/:studentBId/class-history -> 403
    await request(app.getHttpServer())
      .get(`/api/v1/students/${IDS.studentB}/class-history`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(403);

    // Student A accesses own profile, learning-records, and class-history -> 200
    await request(app.getHttpServer())
      .get(`/api/v1/students/${IDS.studentA}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);

    await request(app.getHttpServer())
      .get(`/api/v1/students/${IDS.studentA}/learning-records`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);

    await request(app.getHttpServer())
      .get(`/api/v1/students/${IDS.studentA}/class-history`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
  });

  it('Superadmin Learning Data Isolation: Pure SUPERADMIN is blocked with 403 on learning-records and class-history (FUNC-013, DEC-024)', async () => {
    const saToken = await loginAs('sa.1@webedu.vn');

    await request(app.getHttpServer())
      .get(`/api/v1/students/${IDS.studentA}/learning-records`)
      .set('Authorization', `Bearer ${saToken}`)
      .expect(403);

    await request(app.getHttpServer())
      .get(`/api/v1/students/${IDS.studentA}/class-history`)
      .set('Authorization', `Bearer ${saToken}`)
      .expect(403);
  });

  it('Teacher vs Admin Class History & Inherited Capabilities: Unassigned TEACHER fails closed 403 on learning-records & class-history, ADMIN gets 200 on both (FUNC-009, DEC-024, DEC-026, SEC-F03)', async () => {
    const teacherToken = await loginAs('teacher.1@webedu.vn');
    const adminToken = await loginAs('admin.1@webedu.vn');

    // Unassigned Teacher fails closed on learning-records -> 403 (SEC-F03)
    const unassignedRes = await request(app.getHttpServer())
      .get(`/api/v1/students/${IDS.studentB}/learning-records`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .expect(403);

    expect((unassignedRes.body as ProblemBody).detail).toBe(
      'Giáo viên chỉ được truy cập dữ liệu học tập của học viên thuộc lớp mình đang hoặc đã hoàn thành phụ trách',
    );

    // Teacher CANNOT view student's past class history -> 403 (DEC-024)
    const teacherHistoryRes = await request(app.getHttpServer())
      .get(`/api/v1/students/${IDS.studentA}/class-history`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .expect(403);

    expect((teacherHistoryRes.body as ProblemBody).detail).toBe(
      'Giáo viên không có quyền xem lịch sử lớp cũ của học viên',
    );

    // Admin can access both learning-records (FUNC-009, DEC-026) and class-history (DEC-024) -> 200
    await request(app.getHttpServer())
      .get(`/api/v1/students/${IDS.studentA}/learning-records`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .get(`/api/v1/students/${IDS.studentA}/class-history`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
  });

  it('Multi-Role RBAC & internalNotes Masking (P0-1 / SEC-F02 / SEC-F03): ["SUPERADMIN","STUDENT"] & ["TEACHER","STUDENT"] cannot access other students learning/profile data, and internalNotes is hidden from non-ADMINs', async () => {
    const saStudentToken = await loginAs('sa.student@webedu.vn');
    const teacherStudentToken = await loginAs('teacher.student@webedu.vn');
    const adminToken = await loginAs('admin.1@webedu.vn');
    const pureSaToken = await loginAs('sa.1@webedu.vn');

    // ["SUPERADMIN", "STUDENT"] accessing studentB learning-records -> 403
    await request(app.getHttpServer())
      .get(`/api/v1/students/${IDS.studentB}/learning-records`)
      .set('Authorization', `Bearer ${saStudentToken}`)
      .expect(403);

    // ["SUPERADMIN", "STUDENT"] accessing studentB class-history -> 403
    await request(app.getHttpServer())
      .get(`/api/v1/students/${IDS.studentB}/class-history`)
      .set('Authorization', `Bearer ${saStudentToken}`)
      .expect(403);

    // ["SUPERADMIN", "STUDENT"] accessing OWN learning-records -> 200
    await request(app.getHttpServer())
      .get(`/api/v1/students/${IDS.saStudent}/learning-records`)
      .set('Authorization', `Bearer ${saStudentToken}`)
      .expect(200);

    // ["TEACHER", "STUDENT"] accessing studentB profile -> 403
    await request(app.getHttpServer())
      .get(`/api/v1/students/${IDS.studentB}`)
      .set('Authorization', `Bearer ${teacherStudentToken}`)
      .expect(403);

    // ["TEACHER", "STUDENT"] accessing OWN profile -> 200 with internalNotes: null
    const selfProfileRes = await request(app.getHttpServer())
      .get(`/api/v1/students/${IDS.teacherStudent}`)
      .set('Authorization', `Bearer ${teacherStudentToken}`)
      .expect(200);
    expect((selfProfileRes.body as { internalNotes: string | null }).internalNotes).toBeNull();

    // Pure SUPERADMIN accessing student profile -> 200 with internalNotes: null
    const saProfileRes = await request(app.getHttpServer())
      .get(`/api/v1/students/${IDS.teacherStudent}`)
      .set('Authorization', `Bearer ${pureSaToken}`)
      .expect(200);
    expect((saProfileRes.body as { internalNotes: string | null }).internalNotes).toBeNull();

    // ADMIN accessing student profile -> 200 with real internalNotes
    const adminProfileRes = await request(app.getHttpServer())
      .get(`/api/v1/students/${IDS.teacherStudent}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect((adminProfileRes.body as { internalNotes: string | null }).internalNotes).toBe(
      'Ghi chú nội bộ nhạy cảm của Admin',
    );
  });

  it('Privilege Escalation & Last Superadmin Invariants: ADMIN blocked 403 from modifying SUPERADMIN; SUPERADMIN blocked 400 from self-lockout or removing last active Superadmin (FUNC-013, SEC-07, SEC-08)', async () => {
    const adminToken = await loginAs('admin.1@webedu.vn');
    const sa1Token = await loginAs('sa.1@webedu.vn');

    // ADMIN tries to call Superadmin system-settings endpoint -> 403
    await request(app.getHttpServer())
      .patch(`/api/v1/system-settings/users/${IDS.superadmin1}/roles`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: UserStatus.INACTIVE })
      .expect(403);

    // ADMIN tries to lock a Teacher account that also holds SUPERADMIN role -> 403 (SEC-08)
    await request(app.getHttpServer())
      .patch(`/api/v1/teachers/${IDS.saTeacher}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: UserStatus.INACTIVE })
      .expect(403);

    // ADMIN tries to modify a Student account that also holds SUPERADMIN role -> 403 (P0-2 / SEC-08)
    await request(app.getHttpServer())
      .patch(`/api/v1/students/${IDS.saStudent}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ fullName: 'Hacked SA Student' })
      .expect(403);

    // saTeacher (["TEACHER", "SUPERADMIN"]) tries to self-lock via PATCH /teachers/:saTeacherId -> 400 (P0-2)
    const saTeacherToken = await loginAs('sa.teacher@webedu.vn');
    await request(app.getHttpServer())
      .patch(`/api/v1/teachers/${IDS.saTeacher}`)
      .set('Authorization', `Bearer ${saTeacherToken}`)
      .send({ status: UserStatus.INACTIVE })
      .expect(400);

    // SUPERADMIN 1 tries to deactivate self -> 400
    await request(app.getHttpServer())
      .patch(`/api/v1/system-settings/users/${IDS.superadmin1}/roles`)
      .set('Authorization', `Bearer ${sa1Token}`)
      .send({ status: UserStatus.INACTIVE })
      .expect(400);

    // SUPERADMIN 1 tries to remove own SUPERADMIN role -> 400
    await request(app.getHttpServer())
      .patch(`/api/v1/system-settings/users/${IDS.superadmin1}/roles`)
      .set('Authorization', `Bearer ${sa1Token}`)
      .send({ roles: [Role.ADMIN] })
      .expect(400);

    // Deactivate saTeacher and saStudent first so superadmin1 and superadmin2 remain the 2 active Superadmins
    await request(app.getHttpServer())
      .patch(`/api/v1/system-settings/users/${IDS.saTeacher}/roles`)
      .set('Authorization', `Bearer ${sa1Token}`)
      .send({ status: UserStatus.INACTIVE })
      .expect(200);

    await request(app.getHttpServer())
      .patch(`/api/v1/system-settings/users/${IDS.saStudent}/roles`)
      .set('Authorization', `Bearer ${sa1Token}`)
      .send({ status: UserStatus.INACTIVE })
      .expect(200);

    const sa2Token = await loginAs('sa.2@webedu.vn');

    // Concurrent mutual deactivation (SEC-07 Write-Skew test over HTTP):
    // SA1 tries to deactivate SA2 while SA2 tries to deactivate SA1 simultaneously.
    // Strictly one succeeds (200) and the other is rejected (400 by SEC-07 lock if both passed guard,
    // or 403 by JwtAuthGuard if the first already flipped status=INACTIVE before the second's guard ran).
    const [res1, res2] = await Promise.all([
      request(app.getHttpServer())
        .patch(`/api/v1/system-settings/users/${IDS.superadmin2}/roles`)
        .set('Authorization', `Bearer ${sa1Token}`)
        .send({ status: UserStatus.INACTIVE }),
      request(app.getHttpServer())
        .patch(`/api/v1/system-settings/users/${IDS.superadmin1}/roles`)
        .set('Authorization', `Bearer ${sa2Token}`)
        .send({ status: UserStatus.INACTIVE }),
    ]);

    const okResponses = [res1, res2].filter((r) => r.status === 200);
    const rejectedResponses = [res1, res2].filter((r) => r.status === 400 || r.status === 403);
    expect(okResponses).toHaveLength(1);
    expect(rejectedResponses).toHaveLength(1);

    const activeSuperadmins = Array.from(fakePrisma.users.values()).filter(
      (u) => u.roles.includes(Role.SUPERADMIN) && u.status === UserStatus.ACTIVE,
    );
    expect(activeSuperadmins).toHaveLength(1);
  });
});
