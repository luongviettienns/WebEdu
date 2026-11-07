import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import bcrypt from 'bcryptjs';
import {
  ClassStatus,
  CourseLevel,
  EnrollmentStatus,
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

interface ProblemBody {
  status: number;
  detail: string;
}

describe('RBAC, Multi-Tenant IDOR, DEC-024/025/026 & Superadmin Isolation (e2e — Real PostgreSQL)', () => {
  let harness: RealE2eAppHarness;
  const PASSWORD = 'TestPassword@123';
  let passwordHash: string;

  const IDS = {
    studentA: 'u-student-a',
    studentB: 'u-student-b',
    teacherOld: 'u-teacher-old',
    teacherNew: 'u-teacher-new',
    teacherUnassigned: 'u-teacher-unassigned',
    admin: 'u-admin-1',
    superadmin1: 'u-sa-1',
    superadmin2: 'u-sa-2',
    saTeacher: 'u-sa-teacher',
    saStudent: 'u-sa-student',
    teacherStudent: 'u-teacher-student',
    courseHsk2: 'c-hsk2',
    classActive: 'cls-hsk2-active',
    classCompleted: 'cls-hsk1-completed',
  };

  async function loginSession(email: string): Promise<ExtractedCookieSession> {
    const res = await request(harness.app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password: PASSWORD })
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

    // Seed Teachers first (referenced by Classes)
    await harness.prisma.user.createMany({
      data: [
        {
          id: IDS.teacherOld,
          email: 'teacher.old@webedu.vn',
          phone: '0910000011',
          fullName: 'Giáo Viên Cũ',
          passwordHash,
          roles: [Role.TEACHER],
          status: UserStatus.ACTIVE,
        },
        {
          id: IDS.teacherNew,
          email: 'teacher.new@webedu.vn',
          phone: '0910000012',
          fullName: 'Giáo Viên Mới',
          passwordHash,
          roles: [Role.TEACHER],
          status: UserStatus.ACTIVE,
        },
        {
          id: IDS.teacherUnassigned,
          email: 'teacher.unassigned@webedu.vn',
          phone: '0910000013',
          fullName: 'Giáo Viên Khác',
          passwordHash,
          roles: [Role.TEACHER],
          status: UserStatus.ACTIVE,
        },
      ],
    });

    await harness.prisma.teacherProfile.createMany({
      data: [
        { userId: IDS.teacherOld },
        { userId: IDS.teacherNew },
        { userId: IDS.teacherUnassigned },
      ],
    });

    // Seed Course + Completed Class (led by teacherOld) + Active Class (originally teacherOld, replaced by teacherNew)
    await harness.prisma.course.create({
      data: {
        id: IDS.courseHsk2,
        code: 'HSK2',
        name: 'Tiếng Trung HSK 2 (初级汉语)',
        level: CourseLevel.HSK2,
      },
    });

    await harness.prisma.class.create({
      data: {
        id: IDS.classCompleted,
        code: 'HSK1-DONE-01',
        courseId: IDS.courseHsk2,
        teacherId: IDS.teacherOld,
        status: ClassStatus.COMPLETED,
        startDate: new Date('2026-01-15T00:00:00.000Z'),
        actualEndDate: new Date('2026-06-01T00:00:00.000Z'),
      },
    });

    await harness.prisma.class.create({
      data: {
        id: IDS.classActive,
        code: 'HSK2-LIVE-01',
        courseId: IDS.courseHsk2,
        teacherId: IDS.teacherNew, // Replaced teacherOld!
        status: ClassStatus.ACTIVE,
        startDate: new Date('2026-09-01T00:00:00.000Z'),
      },
    });

    // Seed Students, Admin, Superadmins, and Multi-role accounts
    await harness.prisma.user.createMany({
      data: [
        {
          id: IDS.studentA,
          email: 'student.a@webedu.vn',
          phone: '0910000001',
          fullName: 'Học Viên A',
          passwordHash,
          roles: [Role.STUDENT],
          status: UserStatus.ACTIVE,
        },
        {
          id: IDS.studentB,
          email: 'student.b@webedu.vn',
          phone: '0910000002',
          fullName: 'Học Viên B',
          passwordHash,
          roles: [Role.STUDENT],
          status: UserStatus.ACTIVE,
        },
        {
          id: IDS.admin,
          email: 'admin.1@webedu.vn',
          phone: '0910000004',
          fullName: 'Quản Trị Đào Tạo',
          passwordHash,
          roles: [Role.ADMIN],
          status: UserStatus.ACTIVE,
        },
        {
          id: IDS.superadmin1,
          email: 'sa.1@webedu.vn',
          phone: '0910000005',
          fullName: 'Superadmin 1',
          passwordHash,
          roles: [Role.SUPERADMIN],
          status: UserStatus.ACTIVE,
        },
        {
          id: IDS.superadmin2,
          email: 'sa.2@webedu.vn',
          phone: '0910000006',
          fullName: 'Superadmin 2',
          passwordHash,
          roles: [Role.SUPERADMIN],
          status: UserStatus.ACTIVE,
        },
        {
          id: IDS.saTeacher,
          email: 'sa.teacher@webedu.vn',
          phone: '0910000007',
          fullName: 'Superadmin Kiêm GV',
          passwordHash,
          roles: [Role.TEACHER, Role.SUPERADMIN],
          status: UserStatus.ACTIVE,
        },
        {
          id: IDS.saStudent,
          email: 'sa.student@webedu.vn',
          phone: '0910000008',
          fullName: 'Superadmin Kiêm HV',
          passwordHash,
          roles: [Role.SUPERADMIN, Role.STUDENT],
          status: UserStatus.ACTIVE,
        },
        {
          id: IDS.teacherStudent,
          email: 'teacher.student@webedu.vn',
          phone: '0910000009',
          fullName: 'GV Kiêm Học Viên',
          passwordHash,
          roles: [Role.TEACHER, Role.STUDENT],
          status: UserStatus.ACTIVE,
        },
      ],
    });

    await harness.prisma.teacherProfile.createMany({
      data: [{ userId: IDS.saTeacher }, { userId: IDS.teacherStudent }],
    });

    await harness.prisma.studentProfile.createMany({
      data: [
        {
          userId: IDS.studentA,
          dateOfBirth: new Date('2006-05-10T00:00:00.000Z'),
          assignedClass: 'HSK2-LIVE-01',
          currentClassId: IDS.classActive,
        },
        {
          userId: IDS.studentB,
          dateOfBirth: new Date('2005-08-20T00:00:00.000Z'),
          assignedClass: 'HSK1-DONE-01',
          currentClassId: null,
        },
        {
          userId: IDS.saStudent,
          dateOfBirth: new Date('2002-01-10T00:00:00.000Z'),
          assignedClass: 'HSK2-LIVE-01',
          currentClassId: IDS.classActive,
          internalNotes: 'Ghi chú mật SA-HV',
        },
        {
          userId: IDS.teacherStudent,
          dateOfBirth: new Date('2001-03-15T00:00:00.000Z'),
          assignedClass: 'HSK1-DONE-01',
          internalNotes: 'Ghi chú nội bộ nhạy cảm của Admin',
        },
      ],
    });

    // Enrollments:
    // - Student A is ACTIVE in classActive (taught by teacherNew; teacherOld was replaced!)
    // - Student B COMPLETED classCompleted (taught by teacherOld -> DEC-025 Case 1 READ_ONLY!)
    await harness.prisma.enrollment.createMany({
      data: [
        {
          studentId: IDS.studentA,
          classId: IDS.classActive,
          status: EnrollmentStatus.ACTIVE,
          enrolledDate: new Date('2026-09-01T00:00:00.000Z'),
        },
        {
          studentId: IDS.saStudent,
          classId: IDS.classActive,
          status: EnrollmentStatus.ACTIVE,
          enrolledDate: new Date('2026-09-01T00:00:00.000Z'),
        },
        {
          studentId: IDS.studentB,
          classId: IDS.classCompleted,
          status: EnrollmentStatus.COMPLETED,
          enrolledDate: new Date('2026-01-15T00:00:00.000Z'),
          leftDate: new Date('2026-06-01T00:00:00.000Z'),
        },
      ],
    });
  });

  it('Cross-account / IDOR Guard: Student A gets 403 on Student B endpoints and Student B data stays intact in PostgreSQL (FUNC-010)', async () => {
    const sessionA = await loginSession('student.a@webedu.vn');

    await request(harness.app.getHttpServer())
      .get(`/api/v1/students/${IDS.studentB}`)
      .set('Cookie', sessionA.cookiePair)
      .expect(403);

    await request(harness.app.getHttpServer())
      .patch(`/api/v1/students/${IDS.studentB}`)
      .set('Cookie', sessionA.cookiePair)
      .set('Origin', 'http://localhost:3000')
      .send({ fullName: 'Hacked By Student A' })
      .expect(403);

    const studentBDb = await harness.prisma.user.findUniqueOrThrow({
      where: { id: IDS.studentB },
    });
    expect(studentBDb.fullName).toBe('Học Viên B');

    await request(harness.app.getHttpServer())
      .get(`/api/v1/students/${IDS.studentB}/learning-records`)
      .set('Cookie', sessionA.cookiePair)
      .expect(403);

    await request(harness.app.getHttpServer())
      .get(`/api/v1/students/${IDS.studentB}/class-history`)
      .set('Cookie', sessionA.cookiePair)
      .expect(403);

    // Own resources -> 200 OK
    await request(harness.app.getHttpServer())
      .get(`/api/v1/students/${IDS.studentA}`)
      .set('Cookie', sessionA.cookiePair)
      .expect(200);

    await request(harness.app.getHttpServer())
      .get(`/api/v1/students/${IDS.studentA}/learning-records`)
      .set('Cookie', sessionA.cookiePair)
      .expect(200);

    await request(harness.app.getHttpServer())
      .get(`/api/v1/students/${IDS.studentA}/class-history`)
      .set('Cookie', sessionA.cookiePair)
      .expect(200);
  });

  it('Superadmin Isolation: Pure SUPERADMIN is blocked with 403 on learning-records, class-history, and writing internalNotes (FUNC-013, DEC-024)', async () => {
    const saSession = await loginSession('sa.1@webedu.vn');

    await request(harness.app.getHttpServer())
      .get(`/api/v1/students/${IDS.studentA}/learning-records`)
      .set('Cookie', saSession.cookiePair)
      .expect(403);

    await request(harness.app.getHttpServer())
      .get(`/api/v1/students/${IDS.studentA}/class-history`)
      .set('Cookie', saSession.cookiePair)
      .expect(403);

    // Pure SUPERADMIN attempting to write internalNotes -> 403
    await request(harness.app.getHttpServer())
      .patch(`/api/v1/students/${IDS.studentA}`)
      .set('Cookie', saSession.cookiePair)
      .set('Origin', 'http://localhost:3000')
      .send({ internalNotes: 'Superadmin cố tình ghi chú nội bộ' })
      .expect(403);
  });

  it('DEC-024, DEC-025 (Case 1 & Case 2) & DEC-026: Enforces real PostgreSQL class assignment, teacher replacement loss of access, completed class READ_ONLY, and Admin FULL access', async () => {
    const oldTeacherSession = await loginSession('teacher.old@webedu.vn');
    const newTeacherSession = await loginSession('teacher.new@webedu.vn');
    const unassignedSession = await loginSession('teacher.unassigned@webedu.vn');
    const adminSession = await loginSession('admin.1@webedu.vn');

    // DEC-025 Case 2: teacherOld was replaced by teacherNew on Student A's ACTIVE class -> teacherOld gets 403, teacherNew gets 200 FULL
    await request(harness.app.getHttpServer())
      .get(`/api/v1/students/${IDS.studentA}/learning-records`)
      .set('Cookie', oldTeacherSession.cookiePair)
      .expect(403);

    const newTeacherLiveRes = await request(harness.app.getHttpServer())
      .get(`/api/v1/students/${IDS.studentA}/learning-records`)
      .set('Cookie', newTeacherSession.cookiePair)
      .expect(200);
    expect(
      (newTeacherLiveRes.body as { records: Array<{ accessMode: string }> }).records[0]?.accessMode,
    ).toBe('FULL');

    // DEC-025 Case 1: Student B was in COMPLETED class taught by teacherOld -> teacherOld gets 200 READ_ONLY!
    const oldTeacherCompletedRes = await request(harness.app.getHttpServer())
      .get(`/api/v1/students/${IDS.studentB}/learning-records`)
      .set('Cookie', oldTeacherSession.cookiePair)
      .expect(200);
    expect(
      (oldTeacherCompletedRes.body as { records: Array<{ accessMode: string }> }).records[0]?.accessMode,
    ).toBe('READ_ONLY');

    // Unassigned teacher gets 403 on both students
    await request(harness.app.getHttpServer())
      .get(`/api/v1/students/${IDS.studentA}/learning-records`)
      .set('Cookie', unassignedSession.cookiePair)
      .expect(403);

    // DEC-024: Even currently assigned teacherNew CANNOT view Student A's past class-history -> 403!
    const teacherHistoryRes = await request(harness.app.getHttpServer())
      .get(`/api/v1/students/${IDS.studentA}/class-history`)
      .set('Cookie', newTeacherSession.cookiePair)
      .expect(403);
    expect((teacherHistoryRes.body as ProblemBody).detail).toBe(
      'Giáo viên không có quyền xem lịch sử lớp cũ của học viên',
    );

    // DEC-026: Admin gets 200 FULL on learning-records and 200 on class-history with real enrollment rows
    const adminLearningRes = await request(harness.app.getHttpServer())
      .get(`/api/v1/students/${IDS.studentB}/learning-records`)
      .set('Cookie', adminSession.cookiePair)
      .expect(200);
    expect(
      (adminLearningRes.body as { records: Array<{ accessMode: string }> }).records[0]?.accessMode,
    ).toBe('FULL');

    const adminHistoryRes = await request(harness.app.getHttpServer())
      .get(`/api/v1/students/${IDS.studentB}/class-history`)
      .set('Cookie', adminSession.cookiePair)
      .expect(200);
    expect(
      (adminHistoryRes.body as { pastClasses: Array<{ classCode: string }> }).pastClasses,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ classCode: 'HSK1-DONE-01' }),
      ]),
    );
  });

  it('Multi-Role RBAC & internalNotes Masking: ["SUPERADMIN","STUDENT"] & ["TEACHER","STUDENT"] cannot bypass object-level checks, and internalNotes is visible ONLY to ADMIN', async () => {
    const saStudentSession = await loginSession('sa.student@webedu.vn');
    const teacherStudentSession = await loginSession('teacher.student@webedu.vn');
    const adminSession = await loginSession('admin.1@webedu.vn');
    const pureSaSession = await loginSession('sa.1@webedu.vn');

    await request(harness.app.getHttpServer())
      .get(`/api/v1/students/${IDS.studentB}/learning-records`)
      .set('Cookie', saStudentSession.cookiePair)
      .expect(403);

    await request(harness.app.getHttpServer())
      .get(`/api/v1/students/${IDS.studentB}/class-history`)
      .set('Cookie', saStudentSession.cookiePair)
      .expect(403);

    await request(harness.app.getHttpServer())
      .get(`/api/v1/students/${IDS.saStudent}/learning-records`)
      .set('Cookie', saStudentSession.cookiePair)
      .expect(200);

    await request(harness.app.getHttpServer())
      .get(`/api/v1/students/${IDS.studentB}`)
      .set('Cookie', teacherStudentSession.cookiePair)
      .expect(403);

    const selfProfileRes = await request(harness.app.getHttpServer())
      .get(`/api/v1/students/${IDS.teacherStudent}`)
      .set('Cookie', teacherStudentSession.cookiePair)
      .expect(200);
    expect((selfProfileRes.body as { internalNotes: string | null }).internalNotes).toBeNull();

    const saProfileRes = await request(harness.app.getHttpServer())
      .get(`/api/v1/students/${IDS.teacherStudent}`)
      .set('Cookie', pureSaSession.cookiePair)
      .expect(200);
    expect((saProfileRes.body as { internalNotes: string | null }).internalNotes).toBeNull();

    const adminProfileRes = await request(harness.app.getHttpServer())
      .get(`/api/v1/students/${IDS.teacherStudent}`)
      .set('Cookie', adminSession.cookiePair)
      .expect(200);
    expect((adminProfileRes.body as { internalNotes: string | null }).internalNotes).toBe(
      'Ghi chú nội bộ nhạy cảm của Admin',
    );
  });

  it('SEC-07 & SEC-08 over HTTP + PostgreSQL FOR UPDATE: Blocks privilege escalation and serializes concurrent mutual Superadmin deactivation so >= 1 active Superadmin remains', async () => {
    const adminSession = await loginSession('admin.1@webedu.vn');
    const sa1Session = await loginSession('sa.1@webedu.vn');

    // ADMIN blocked on Superadmin endpoints & dual-role Superadmin accounts
    await request(harness.app.getHttpServer())
      .patch(`/api/v1/system-settings/users/${IDS.superadmin1}/roles`)
      .set('Cookie', adminSession.cookiePair)
      .set('Origin', 'http://localhost:3000')
      .send({ status: UserStatus.INACTIVE })
      .expect(403);

    await request(harness.app.getHttpServer())
      .patch(`/api/v1/teachers/${IDS.saTeacher}`)
      .set('Cookie', adminSession.cookiePair)
      .set('Origin', 'http://localhost:3000')
      .send({ status: UserStatus.INACTIVE })
      .expect(403);

    await request(harness.app.getHttpServer())
      .patch(`/api/v1/students/${IDS.saStudent}`)
      .set('Cookie', adminSession.cookiePair)
      .set('Origin', 'http://localhost:3000')
      .send({ fullName: 'Hacked SA Student' })
      .expect(403);

    // Dual-role Superadmin blocked from self-lockout via /teachers/:id
    const saTeacherSession = await loginSession('sa.teacher@webedu.vn');
    await request(harness.app.getHttpServer())
      .patch(`/api/v1/teachers/${IDS.saTeacher}`)
      .set('Cookie', saTeacherSession.cookiePair)
      .set('Origin', 'http://localhost:3000')
      .send({ status: UserStatus.INACTIVE })
      .expect(400);

    // Deactivate saTeacher and saStudent first so superadmin1 and superadmin2 are the last 2 active Superadmins
    await request(harness.app.getHttpServer())
      .patch(`/api/v1/system-settings/users/${IDS.saTeacher}/roles`)
      .set('Cookie', sa1Session.cookiePair)
      .set('Origin', 'http://localhost:3000')
      .send({ status: UserStatus.INACTIVE })
      .expect(200);

    await request(harness.app.getHttpServer())
      .patch(`/api/v1/system-settings/users/${IDS.saStudent}/roles`)
      .set('Cookie', sa1Session.cookiePair)
      .set('Origin', 'http://localhost:3000')
      .send({ status: UserStatus.INACTIVE })
      .expect(200);

    const sa2Session = await loginSession('sa.2@webedu.vn');

    const [res1, res2] = await Promise.all([
      request(harness.app.getHttpServer())
        .patch(`/api/v1/system-settings/users/${IDS.superadmin2}/roles`)
        .set('Cookie', sa1Session.cookiePair)
        .set('Origin', 'http://localhost:3000')
        .send({ status: UserStatus.INACTIVE }),
      request(harness.app.getHttpServer())
        .patch(`/api/v1/system-settings/users/${IDS.superadmin1}/roles`)
        .set('Cookie', sa2Session.cookiePair)
        .set('Origin', 'http://localhost:3000')
        .send({ status: UserStatus.INACTIVE }),
    ]);

    const okResponses = [res1, res2].filter((r) => r.status === 200);
    const rejectedResponses = [res1, res2].filter(
      (r) => r.status === 400 || r.status === 401 || r.status === 403,
    );
    expect(okResponses).toHaveLength(1);
    expect(rejectedResponses).toHaveLength(1);

    const remainingActiveSuperadmins = await harness.prisma.user.count({
      where: {
        roles: { has: Role.SUPERADMIN },
        status: UserStatus.ACTIVE,
      },
    });
    expect(remainingActiveSuperadmins).toBe(1);
  });

  it('Stage E RBAC Hardening: Revokes Teacher learning-records access on TRANSFERRED/DROPPED enrollments and enforces default-deny pure SUPERADMIN on FUNC-008 enrollment endpoints', async () => {
    const newTeacherSession = await loginSession('teacher.new@webedu.vn');
    const saSession = await loginSession('sa.1@webedu.vn');

    // 1. Critic Finding 2: When Student A transfers/drops out of classActive (still ACTIVE), teacherNew loses access immediately -> 403!
    await harness.prisma.enrollment.updateMany({
      where: { studentId: IDS.studentA, classId: IDS.classActive },
      data: { status: EnrollmentStatus.TRANSFERRED, leftDate: new Date() },
    });

    await request(harness.app.getHttpServer())
      .get(`/api/v1/students/${IDS.studentA}/learning-records`)
      .set('Cookie', newTeacherSession.cookiePair)
      .expect(403);

    await harness.prisma.enrollment.updateMany({
      where: { studentId: IDS.studentA, classId: IDS.classActive },
      data: { status: EnrollmentStatus.DROPPED },
    });

    await request(harness.app.getHttpServer())
      .get(`/api/v1/students/${IDS.studentA}/learning-records`)
      .set('Cookie', newTeacherSession.cookiePair)
      .expect(403);

    // 2. Critic Finding 5: Pure SUPERADMIN is default-denied (403) on FUNC-008 endpoints, while dual-role [SUPERADMIN, ADMIN] succeeds (200)
    await request(harness.app.getHttpServer())
      .get('/api/v1/students/pending-enrollment')
      .set('Cookie', saSession.cookiePair)
      .expect(403);

    await request(harness.app.getHttpServer())
      .get('/api/v1/students/available-classes')
      .set('Cookie', saSession.cookiePair)
      .expect(403);

    await request(harness.app.getHttpServer())
      .post(`/api/v1/students/${IDS.studentA}/assign-initial-class`)
      .set('Cookie', saSession.cookiePair)
      .set('Origin', 'http://localhost:3000')
      .send({ classNameOrId: IDS.classActive })
      .expect(403);

    await harness.prisma.user.create({
      data: {
        email: 'dual.sa.admin@webedu.vn',
        phone: '0910000099',
        fullName: 'SA Kiêm Admin Học Vụ',
        passwordHash,
        roles: [Role.SUPERADMIN, Role.ADMIN],
        status: UserStatus.ACTIVE,
      },
    });
    const dualSaAdminSession = await loginSession('dual.sa.admin@webedu.vn');

    await request(harness.app.getHttpServer())
      .get('/api/v1/students/pending-enrollment')
      .set('Cookie', dualSaAdminSession.cookiePair)
      .expect(200);

    await request(harness.app.getHttpServer())
      .get('/api/v1/students/available-classes')
      .set('Cookie', dualSaAdminSession.cookiePair)
      .expect(200);
  });
});
