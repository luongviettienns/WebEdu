import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import {
  ClassStatus,
  CourseLevel,
  EnrollmentStatus,
  Role,
  UserStatus,
} from '@prisma/client';
import {
  createRealE2eAppHarness,
  extractAuthCookie,
  type RealE2eAppHarness,
} from './helpers/e2e-app-harness.js';

describe('Phase 3 E2E — HSK Courses Catalog, Class Lifecycle, Enrollments, BOLA & Concurrency (Real PostgreSQL 16)', () => {
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

  async function seedActors() {
    const server = harness.app.getHttpServer();
    const passwordHash = await bcrypt.hash('Password123', 10);

    const pureSuperadmin = await harness.prisma.user.create({
      data: {
        email: 'p3.sa@webedu.vn',
        phone: '0930000001',
        fullName: 'Pure Superadmin P3',
        passwordHash,
        roles: [Role.SUPERADMIN],
        status: UserStatus.ACTIVE,
      },
    });

    const admin = await harness.prisma.user.create({
      data: {
        email: 'p3.admin@webedu.vn',
        phone: '0930000002',
        fullName: 'Academic Admin P3',
        passwordHash,
        roles: [Role.ADMIN],
        status: UserStatus.ACTIVE,
      },
    });

    const teacher1 = await harness.prisma.user.create({
      data: {
        email: 'p3.teacher1@webedu.vn',
        phone: '0930000003',
        fullName: 'Lý Lão Sư (Teacher 1)',
        passwordHash,
        roles: [Role.TEACHER],
        status: UserStatus.ACTIVE,
        teacherProfile: { create: { activeClassesCount: 0 } },
      },
    });

    const teacher2 = await harness.prisma.user.create({
      data: {
        email: 'p3.teacher2@webedu.vn',
        phone: '0930000004',
        fullName: 'Trương Lão Sư (Teacher 2)',
        passwordHash,
        roles: [Role.TEACHER],
        status: UserStatus.ACTIVE,
        teacherProfile: { create: { activeClassesCount: 0 } },
      },
    });

    const student1 = await harness.prisma.user.create({
      data: {
        email: 'p3.student1@webedu.vn',
        phone: '0930000005',
        fullName: 'Nguyễn Minh An (Student 1)',
        passwordHash,
        roles: [Role.STUDENT],
        status: UserStatus.PENDING_CLASS,
        studentProfile: {
          create: {
            dateOfBirth: new Date('2004-03-15T00:00:00.000Z'),
          },
        },
      },
    });

    const student2 = await harness.prisma.user.create({
      data: {
        email: 'p3.student2@webedu.vn',
        phone: '0930000006',
        fullName: 'Trần Thu Hà (Student 2)',
        passwordHash,
        roles: [Role.STUDENT],
        status: UserStatus.PENDING_CLASS,
        studentProfile: {
          create: {
            dateOfBirth: new Date('2005-07-20T00:00:00.000Z'),
          },
        },
      },
    });

    const student3 = await harness.prisma.user.create({
      data: {
        email: 'p3.student3@webedu.vn',
        phone: '0930000007',
        fullName: 'Lê Hoàng Nam (Student 3)',
        passwordHash,
        roles: [Role.STUDENT],
        status: UserStatus.PENDING_CLASS,
        studentProfile: {
          create: {
            dateOfBirth: new Date('2003-11-05T00:00:00.000Z'),
          },
        },
      },
    });

    const loginAs = async (email: string): Promise<string> => {
      const res = await request(server)
        .post('/api/v1/auth/login')
        .send({ email, password: 'Password123' })
        .expect(200);
      return extractAuthCookie(res).jwtToken;
    };

    const [
      saToken,
      adminToken,
      teacher1Token,
      teacher2Token,
      student1Token,
    ] = await Promise.all([
      loginAs(pureSuperadmin.email),
      loginAs(admin.email),
      loginAs(teacher1.email),
      loginAs(teacher2.email),
      loginAs(student1.email),
    ]);

    return {
      server,
      pureSuperadmin,
      admin,
      teacher1,
      teacher2,
      student1,
      student2,
      student3,
      saToken,
      adminToken,
      teacher1Token,
      teacher2Token,
      student1Token,
    };
  }

  it('Scenario 1: HSK Courses Catalog (GET/POST/PATCH /api/v1/courses), RBAC isolation, duplicate code 409, and canonical HSK level sorting', async () => {
    const { server, saToken, adminToken, teacher1Token, student1Token } =
      await seedActors();

    // Pure SUPERADMIN and STUDENT receive 403 Forbidden on GET and POST /api/v1/courses
    for (const token of [saToken, student1Token]) {
      await request(server)
        .get('/api/v1/courses')
        .set('Authorization', `Bearer ${token}`)
        .expect(403);

      await request(server)
        .post('/api/v1/courses')
        .set('Authorization', `Bearer ${token}`)
        .send({
          code: 'HSK1',
          name: 'Tiếng Trung HSK 1',
          level: CourseLevel.HSK1,
          defaultSessions: 24,
        })
        .expect(403);
    }

    // TEACHER receives 200 OK on GET /api/v1/courses and 403 Forbidden on POST /api/v1/courses
    await request(server)
      .get('/api/v1/courses')
      .set('Authorization', `Bearer ${teacher1Token}`)
      .expect(200);

    await request(server)
      .post('/api/v1/courses')
      .set('Authorization', `Bearer ${teacher1Token}`)
      .send({
        code: 'HSK1',
        name: 'Tiếng Trung HSK 1',
        level: CourseLevel.HSK1,
        defaultSessions: 24,
      })
      .expect(403);

    // ADMIN creates GT-CB, HSK2, HSK1 (out of order) + an archived course HSK3-OLD
    const gtCbRes = await request(server)
      .post('/api/v1/courses')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        code: 'gt-cb',
        name: 'Giao Tiếp Cơ Bản Tiếng Trung',
        level: CourseLevel.BASIC_COMMUNICATION,
        defaultSessions: 18,
      })
      .expect(201);
    expect(gtCbRes.body.code).toBe('GT-CB');
    expect(gtCbRes.body.defaultSessions).toBe(18);

    const hsk2Res = await request(server)
      .post('/api/v1/courses')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        code: 'HSK2',
        name: 'Tiếng Trung HSK 2 — 汉语水平考试二级',
        level: CourseLevel.HSK2,
        defaultSessions: 30,
      })
      .expect(201);

    const hsk1Res = await request(server)
      .post('/api/v1/courses')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        code: 'HSK1',
        name: 'Tiếng Trung HSK 1 — 汉语水平考试一级',
        level: CourseLevel.HSK1,
        defaultSessions: 24,
      })
      .expect(201);

    const hsk3OldRes = await request(server)
      .post('/api/v1/courses')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        code: 'HSK3-OLD',
        name: 'HSK 3 Giáo Trình Cũ',
        level: CourseLevel.HSK3,
        defaultSessions: 32,
      })
      .expect(201);

    // Duplicate course code returns 409 Conflict
    await request(server)
      .post('/api/v1/courses')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        code: 'hsk1',
        name: 'Duplicate HSK 1',
        level: CourseLevel.HSK1,
        defaultSessions: 24,
      })
      .expect(409);

    // ADMIN updates defaultSessions on GT-CB and deactivates HSK3-OLD via PATCH /api/v1/courses/:id
    const updatedGtCb = await request(server)
      .patch(`/api/v1/courses/${gtCbRes.body.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ defaultSessions: 20 })
      .expect(200);
    expect(updatedGtCb.body.defaultSessions).toBe(20);

    const deactivatedHsk3 = await request(server)
      .patch(`/api/v1/courses/${hsk3OldRes.body.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ defaultSessions: 36, isActive: false })
      .expect(200);
    expect(deactivatedHsk3.body.defaultSessions).toBe(36);
    expect(deactivatedHsk3.body.isActive).toBe(false);

    // GET /api/v1/courses?activeOnly=true hides deactivated courses and sorts HSK1 -> HSK2 -> BASIC_COMMUNICATION
    const activeCatalog = await request(server)
      .get('/api/v1/courses?activeOnly=true')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(activeCatalog.body.total).toBe(3);
    expect(
      activeCatalog.body.items.map((item: { code: string }) => item.code),
    ).toEqual([hsk1Res.body.code, hsk2Res.body.code, gtCbRes.body.code]);
  });

  it('Scenario 2: Class creation, schedule conflict warning, teacher reassignment history & Replaced Teacher BOLA isolation', async () => {
    const {
      server,
      teacher1,
      teacher2,
      saToken,
      adminToken,
      teacher1Token,
      teacher2Token,
    } = await seedActors();

    const hsk1 = await request(server)
      .post('/api/v1/courses')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        code: 'HSK1',
        name: 'Tiếng Trung HSK 1',
        level: CourseLevel.HSK1,
        defaultSessions: 24,
      })
      .expect(201);

    const hsk2 = await request(server)
      .post('/api/v1/courses')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        code: 'HSK2',
        name: 'Tiếng Trung HSK 2',
        level: CourseLevel.HSK2,
        defaultSessions: 30,
      })
      .expect(201);

    // 1. ADMIN creates Class A assigned to Teacher 1 (totalSessions defaults from course defaultSessions = 24)
    const classARes = await request(server)
      .post('/api/v1/classes')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        code: 'HSK1-K26-01',
        courseId: hsk1.body.id,
        teacherId: teacher1.id,
        scheduleDays: [1, 3, 5],
        scheduleStartTime: '18:00',
        scheduleEndTime: '19:30',
        startDate: '2026-11-02',
        status: ClassStatus.ACTIVE,
      })
      .expect(201);

    expect(classARes.body.totalSessions).toBe(24);
    expect(classARes.body.expectedEndDate).toBe('2026-12-25');
    expect(classARes.body.scheduleConflictWarning).toBeNull();

    const t1ProfileAfterA = await harness.prisma.teacherProfile.findUniqueOrThrow({
      where: { userId: teacher1.id },
    });
    expect(t1ProfileAfterA.activeClassesCount).toBe(1);

    const historyAfterA = await harness.prisma.classTeacherAssignment.findMany({
      where: { classId: classARes.body.id },
    });
    expect(historyAfterA).toHaveLength(1);
    expect(historyAfterA[0]?.teacherId).toBe(teacher1.id);
    expect(historyAfterA[0]?.assignedTo).toBeNull();

    // 2. ADMIN creates Class B with overlapping schedule ([1, 3, 5], 18:30-20:00) for Teacher 1
    const classBRes = await request(server)
      .post('/api/v1/classes')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        code: 'HSK2-K26-01',
        courseId: hsk2.body.id,
        teacherId: teacher1.id,
        scheduleDays: [1, 3, 5],
        scheduleStartTime: '18:30',
        scheduleEndTime: '20:00',
        startDate: '2026-11-02',
        status: ClassStatus.ACTIVE,
      })
      .expect(201);

    expect(classBRes.body.scheduleConflictWarning).toContain('HSK1-K26-01');

    const t1ProfileAfterB = await harness.prisma.teacherProfile.findUniqueOrThrow({
      where: { userId: teacher1.id },
    });
    expect(t1ProfileAfterB.activeClassesCount).toBe(2);

    // 3. ADMIN reassigns Class A from Teacher 1 to Teacher 2 via PATCH /api/v1/classes/:id
    await request(server)
      .patch(`/api/v1/classes/${classARes.body.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        teacherId: teacher2.id,
        teacherAssignedFrom: '2026-11-09',
        teacherChangeReason: 'Điều chuyển công tác giảng dạy sang cô Trương',
      })
      .expect(200);

    const [t1AfterReassign, t2AfterReassign] = await Promise.all([
      harness.prisma.teacherProfile.findUniqueOrThrow({
        where: { userId: teacher1.id },
      }),
      harness.prisma.teacherProfile.findUniqueOrThrow({
        where: { userId: teacher2.id },
      }),
    ]);
    expect(t1AfterReassign.activeClassesCount).toBe(1);
    expect(t2AfterReassign.activeClassesCount).toBe(1);

    // 4. Replaced Teacher BOLA Check: Teacher 1 calls GET /api/v1/classes/:classAId -> 403 Forbidden
    await request(server)
      .get(`/api/v1/classes/${classARes.body.id}`)
      .set('Authorization', `Bearer ${teacher1Token}`)
      .expect(403);

    // Teacher 2 calls GET /api/v1/classes/:classAId -> 200 OK with accessMode: 'FULL' and 2 teacherHistory records
    const t2ClassADetail = await request(server)
      .get(`/api/v1/classes/${classARes.body.id}`)
      .set('Authorization', `Bearer ${teacher2Token}`)
      .expect(200);

    expect(t2ClassADetail.body.accessMode).toBe('FULL');
    expect(t2ClassADetail.body.teacherHistory).toHaveLength(2);
    const openAssignment = t2ClassADetail.body.teacherHistory.find(
      (h: { teacherId: string; assignedTo: string | null }) =>
        h.teacherId === teacher2.id,
    );
    const closedAssignment = t2ClassADetail.body.teacherHistory.find(
      (h: { teacherId: string; assignedTo: string | null }) =>
        h.teacherId === teacher1.id,
    );
    expect(openAssignment?.assignedTo).toBeNull();
    expect(closedAssignment?.assignedTo).toBe('2026-11-09');

    // 5. Pure SUPERADMIN calls GET /api/v1/classes and GET /api/v1/classes/:classAId -> 403 Forbidden
    await request(server)
      .get('/api/v1/classes')
      .set('Authorization', `Bearer ${saToken}`)
      .expect(403);

    await request(server)
      .get(`/api/v1/classes/${classARes.body.id}`)
      .set('Authorization', `Bearer ${saToken}`)
      .expect(403);
  });

  it('Scenario 3: Batch student enrollment, concurrency race on idx_unique_student_active_enrollment, transfer, drop & class-history BOLA isolation', async () => {
    const {
      server,
      teacher1,
      teacher2,
      student1,
      student2,
      student3,
      adminToken,
      teacher1Token,
      teacher2Token,
      student1Token,
    } = await seedActors();

    const hsk1 = await request(server)
      .post('/api/v1/courses')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        code: 'HSK1',
        name: 'Tiếng Trung HSK 1',
        level: CourseLevel.HSK1,
        defaultSessions: 24,
      })
      .expect(201);

    const hsk2 = await request(server)
      .post('/api/v1/courses')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        code: 'HSK2',
        name: 'Tiếng Trung HSK 2',
        level: CourseLevel.HSK2,
        defaultSessions: 30,
      })
      .expect(201);

    const classA = await request(server)
      .post('/api/v1/classes')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        code: 'HSK1-K26-01',
        courseId: hsk1.body.id,
        teacherId: teacher2.id,
        scheduleDays: [1, 3, 5],
        scheduleStartTime: '18:00',
        scheduleEndTime: '19:30',
        startDate: '2026-11-02',
        status: ClassStatus.ACTIVE,
      })
      .expect(201);

    const classB = await request(server)
      .post('/api/v1/classes')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        code: 'HSK2-K26-01',
        courseId: hsk2.body.id,
        teacherId: teacher1.id,
        scheduleDays: [2, 4, 6],
        scheduleStartTime: '19:30',
        scheduleEndTime: '21:00',
        startDate: '2026-11-03',
        status: ClassStatus.ACTIVE,
      })
      .expect(201);

    // 1. Batch-enroll Student 1 and Student 2 into Class A
    const batchEnrollRes = await request(server)
      .post(`/api/v1/classes/${classA.body.id}/enrollments`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        studentIds: [student1.id, student2.id],
        enrolledDate: '2026-11-02',
      })
      .expect(200);

    expect(batchEnrollRes.body.enrolledCount).toBe(2);

    const [s1AfterBatch, s2AfterBatch] = await Promise.all([
      harness.prisma.user.findUniqueOrThrow({
        where: { id: student1.id },
        include: { studentProfile: true },
      }),
      harness.prisma.user.findUniqueOrThrow({
        where: { id: student2.id },
        include: { studentProfile: true },
      }),
    ]);
    expect(s1AfterBatch.status).toBe(UserStatus.ACTIVE);
    expect(s1AfterBatch.studentProfile?.currentClassId).toBe(classA.body.id);
    expect(s2AfterBatch.status).toBe(UserStatus.ACTIVE);
    expect(s2AfterBatch.studentProfile?.currentClassId).toBe(classA.body.id);

    // 2. Concurrency Race Condition Test: simultaneously enroll Student 3 into Class A and Class B
    const [raceResA, raceResB] = await Promise.all([
      request(server)
        .post(`/api/v1/classes/${classA.body.id}/enrollments`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ studentIds: [student3.id], enrolledDate: '2026-11-03' }),
      request(server)
        .post(`/api/v1/classes/${classB.body.id}/enrollments`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ studentIds: [student3.id], enrolledDate: '2026-11-03' }),
    ]);

    const raceStatuses = [raceResA.status, raceResB.status].sort((a, b) => a - b);
    expect(raceStatuses).toEqual([200, 409]);

    const s3ActiveEnrollments = await harness.prisma.enrollment.findMany({
      where: { studentId: student3.id, status: EnrollmentStatus.ACTIVE },
    });
    expect(s3ActiveEnrollments).toHaveLength(1);

    // 3. Class Transfer: ADMIN transfers Student 1 from Class A to Class B
    const transferRes = await request(server)
      .post(
        `/api/v1/classes/${classA.body.id}/enrollments/${student1.id}/transfer`,
      )
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        targetClassId: classB.body.id,
        transferDate: '2026-11-10',
        reason: 'Vượt chuẩn đầu vào, chuyển lên lớp HSK2-K26-01',
      })
      .expect(200);

    expect(transferRes.body.status).toBe('TRANSFERRED');
    expect(transferRes.body.targetClassCode).toBe('HSK2-K26-01');

    const s1AfterTransfer = await harness.prisma.user.findUniqueOrThrow({
      where: { id: student1.id },
      include: { studentProfile: true, enrollments: true },
    });
    expect(s1AfterTransfer.studentProfile?.currentClassId).toBe(classB.body.id);
    expect(s1AfterTransfer.studentProfile?.assignedClass).toBe('HSK2-K26-01');

    const s1ClassAEnrollment = s1AfterTransfer.enrollments.find(
      (e) => e.classId === classA.body.id,
    );
    const s1ClassBEnrollment = s1AfterTransfer.enrollments.find(
      (e) => e.classId === classB.body.id,
    );
    expect(s1ClassAEnrollment?.status).toBe(EnrollmentStatus.TRANSFERRED);
    expect(s1ClassAEnrollment?.leftDate).not.toBeNull();
    expect(s1ClassBEnrollment?.status).toBe(EnrollmentStatus.ACTIVE);

    // 4. Class History Isolation (GET /api/v1/students/:id/class-history)
    for (const viewerToken of [student1Token, adminToken]) {
      const historyRes = await request(server)
        .get(`/api/v1/students/${student1.id}/class-history`)
        .set('Authorization', `Bearer ${viewerToken}`)
        .expect(200);

      expect(historyRes.body.currentClass).toBe('HSK2-K26-01');
      expect(historyRes.body.pastClasses).toHaveLength(1);
      expect(historyRes.body.pastClasses[0]?.classCode).toBe('HSK1-K26-01');
      expect(historyRes.body.pastClasses[0]?.enrollmentStatus).toBe(
        'TRANSFERRED',
      );
    }

    // Teacher 1 and Teacher 2 call GET /api/v1/students/:student1Id/class-history -> both 403 Forbidden
    for (const teacherToken of [teacher1Token, teacher2Token]) {
      await request(server)
        .get(`/api/v1/students/${student1.id}/class-history`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .expect(403);
    }

    // 5. Drop Student: ADMIN drops Student 2 from Class A -> DROPPED & returns to PENDING_CLASS
    const dropRes = await request(server)
      .post(`/api/v1/classes/${classA.body.id}/enrollments/${student2.id}/drop`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        leftDate: '2026-11-12',
        reason: 'Bảo lưu cá nhân 2 tháng',
      })
      .expect(200);

    expect(dropRes.body.status).toBe('DROPPED');

    const s2AfterDrop = await harness.prisma.user.findUniqueOrThrow({
      where: { id: student2.id },
      include: { studentProfile: true, enrollments: true },
    });
    expect(s2AfterDrop.status).toBe(UserStatus.PENDING_CLASS);
    expect(s2AfterDrop.studentProfile?.currentClassId).toBeNull();
    expect(s2AfterDrop.enrollments[0]?.status).toBe(EnrollmentStatus.DROPPED);

    // ADMIN can still edit Student 2's internalNotes via PATCH /api/v1/students/:id while status remains PENDING_CLASS
    const patchS2Notes = await request(server)
      .patch(`/api/v1/students/${student2.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        status: UserStatus.PENDING_CLASS,
        internalNotes: 'Học viên bảo lưu sau 4 buổi tại lớp HSK1-K26-01',
      })
      .expect(200);

    expect(patchS2Notes.body.status).toBe(UserStatus.PENDING_CLASS);
    expect(patchS2Notes.body.internalNotes).toBe(
      'Học viên bảo lưu sau 4 buổi tại lớp HSK1-K26-01',
    );
  });

  it('Scenario 4: Complete Class (READ_ONLY) & 7-Day Reopen Window with partial student re-enrollment safety', async () => {
    const {
      server,
      teacher1,
      teacher2,
      student1,
      student2,
      student3,
      adminToken,
      teacher1Token,
    } = await seedActors();

    const hsk1 = await request(server)
      .post('/api/v1/courses')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        code: 'HSK1',
        name: 'Tiếng Trung HSK 1',
        level: CourseLevel.HSK1,
        defaultSessions: 24,
      })
      .expect(201);

    const hsk2 = await request(server)
      .post('/api/v1/courses')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        code: 'HSK2',
        name: 'Tiếng Trung HSK 2',
        level: CourseLevel.HSK2,
        defaultSessions: 30,
      })
      .expect(201);

    const classA = await request(server)
      .post('/api/v1/classes')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        code: 'HSK1-K26-01',
        courseId: hsk1.body.id,
        teacherId: teacher2.id,
        scheduleDays: [1, 3, 5],
        scheduleStartTime: '18:00',
        scheduleEndTime: '19:30',
        startDate: '2026-11-02',
        status: ClassStatus.ACTIVE,
      })
      .expect(201);

    const classB = await request(server)
      .post('/api/v1/classes')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        code: 'HSK2-K26-01',
        courseId: hsk2.body.id,
        teacherId: teacher1.id,
        scheduleDays: [2, 4, 6],
        scheduleStartTime: '19:30',
        scheduleEndTime: '21:00',
        startDate: '2026-11-03',
        status: ClassStatus.ACTIVE,
      })
      .expect(201);

    // Prepare state: Student 1 transferred Class A -> Class B, Student 2 dropped from Class A, Student 3 active in Class B
    await request(server)
      .post(`/api/v1/classes/${classA.body.id}/enrollments`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        studentIds: [student1.id, student2.id],
        enrolledDate: '2026-11-02',
      })
      .expect(200);

    await request(server)
      .post(
        `/api/v1/classes/${classA.body.id}/enrollments/${student1.id}/transfer`,
      )
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        targetClassId: classB.body.id,
        transferDate: '2026-11-10',
        reason: 'Chuyển sang lớp HSK2-K26-01',
      })
      .expect(200);

    await request(server)
      .post(`/api/v1/classes/${classA.body.id}/enrollments/${student2.id}/drop`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ leftDate: '2026-11-12', reason: 'Bảo lưu' })
      .expect(200);

    await request(server)
      .post(`/api/v1/classes/${classB.body.id}/enrollments`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ studentIds: [student3.id], enrolledDate: '2026-11-03' })
      .expect(200);

    // 1. ADMIN completes Class B -> status COMPLETED, accessMode READ_ONLY, Teacher 1 activeClassesCount = 0
    const completeBRes = await request(server)
      .post(`/api/v1/classes/${classB.body.id}/complete`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        actualEndDate: '2026-12-26',
        reason: 'Hoàn thành chương trình HSK 2 đúng tiến độ',
      })
      .expect(200);

    expect(completeBRes.body.status).toBe(ClassStatus.COMPLETED);
    expect(completeBRes.body.accessMode).toBe('READ_ONLY');

    const t1AfterCompleteB =
      await harness.prisma.teacherProfile.findUniqueOrThrow({
        where: { userId: teacher1.id },
      });
    expect(t1AfterCompleteB.activeClassesCount).toBe(0);

    // Student 1 and Student 3 return to PENDING_CLASS with COMPLETED enrollment in Class B,
    // while Student 1's TRANSFERRED and Student 2's DROPPED enrollments in Class A remain untouched
    const [s1AfterCompleteB, s3AfterCompleteB, classAEnrollmentsCheck] =
      await Promise.all([
        harness.prisma.user.findUniqueOrThrow({
          where: { id: student1.id },
          include: { studentProfile: true, enrollments: true },
        }),
        harness.prisma.user.findUniqueOrThrow({
          where: { id: student3.id },
          include: { studentProfile: true, enrollments: true },
        }),
        harness.prisma.enrollment.findMany({
          where: { classId: classA.body.id },
        }),
      ]);

    expect(s1AfterCompleteB.status).toBe(UserStatus.PENDING_CLASS);
    expect(s1AfterCompleteB.studentProfile?.currentClassId).toBeNull();
    expect(
      s1AfterCompleteB.enrollments.find((e) => e.classId === classB.body.id)
        ?.status,
    ).toBe(EnrollmentStatus.COMPLETED);

    expect(s3AfterCompleteB.status).toBe(UserStatus.PENDING_CLASS);
    expect(s3AfterCompleteB.studentProfile?.currentClassId).toBeNull();

    const s1InClassA = classAEnrollmentsCheck.find(
      (e) => e.studentId === student1.id,
    );
    const s2InClassA = classAEnrollmentsCheck.find(
      (e) => e.studentId === student2.id,
    );
    expect(s1InClassA?.status).toBe(EnrollmentStatus.TRANSFERRED);
    expect(s2InClassA?.status).toBe(EnrollmentStatus.DROPPED);

    // 2. Teacher 1 (final teacher of completed Class B) calls GET /api/v1/classes/:classBId -> 200 OK with READ_ONLY
    const t1CompletedBView = await request(server)
      .get(`/api/v1/classes/${classB.body.id}`)
      .set('Authorization', `Bearer ${teacher1Token}`)
      .expect(200);
    expect(t1CompletedBView.body.accessMode).toBe('READ_ONLY');

    // 3. Attempting PATCH or POST enrollments on completed Class B returns 400 BadRequestException
    await request(server)
      .patch(`/api/v1/classes/${classB.body.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ notes: 'Thử sửa lớp đã kết thúc' })
      .expect(400);

    await request(server)
      .post(`/api/v1/classes/${classB.body.id}/enrollments`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ studentIds: [student2.id], enrolledDate: '2026-12-27' })
      .expect(400);

    // 4. Enroll Student 1 into new Class C (ACTIVE), while Student 3 remains PENDING_CLASS.
    // Reopening Class B within 7 days restores Student 3 to ACTIVE in Class B while keeping Student 1 safely ACTIVE in Class C!
    const classC = await request(server)
      .post('/api/v1/classes')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        code: 'HSK2-K26-02',
        courseId: hsk2.body.id,
        teacherId: teacher2.id,
        scheduleDays: [2, 4, 6],
        scheduleStartTime: '18:00',
        scheduleEndTime: '19:30',
        startDate: '2026-12-28',
        status: ClassStatus.ACTIVE,
      })
      .expect(201);

    await request(server)
      .post(`/api/v1/classes/${classC.body.id}/enrollments`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ studentIds: [student1.id], enrolledDate: '2026-12-28' })
      .expect(200);

    const reopenRes = await request(server)
      .post(`/api/v1/classes/${classB.body.id}/reopen`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'Mở lại lớp để nhập bổ sung đánh giá cuối khóa' })
      .expect(200);

    expect(reopenRes.body.status).toBe(ClassStatus.ACTIVE);
    expect(reopenRes.body.accessMode).toBe('FULL');

    const [s1AfterReopen, s3AfterReopen] = await Promise.all([
      harness.prisma.user.findUniqueOrThrow({
        where: { id: student1.id },
        include: { studentProfile: true, enrollments: true },
      }),
      harness.prisma.user.findUniqueOrThrow({
        where: { id: student3.id },
        include: { studentProfile: true, enrollments: true },
      }),
    ]);

    // Student 1 stays ACTIVE in Class C and COMPLETED in Class B
    expect(s1AfterReopen.status).toBe(UserStatus.ACTIVE);
    expect(s1AfterReopen.studentProfile?.currentClassId).toBe(classC.body.id);
    expect(
      s1AfterReopen.enrollments.find((e) => e.classId === classB.body.id)
        ?.status,
    ).toBe(EnrollmentStatus.COMPLETED);
    expect(
      s1AfterReopen.enrollments.find((e) => e.classId === classC.body.id)
        ?.status,
    ).toBe(EnrollmentStatus.ACTIVE);

    // Student 3 is restored to ACTIVE in Class B
    expect(s3AfterReopen.status).toBe(UserStatus.ACTIVE);
    expect(s3AfterReopen.studentProfile?.currentClassId).toBe(classB.body.id);
    expect(
      s3AfterReopen.enrollments.find((e) => e.classId === classB.body.id)
        ?.status,
    ).toBe(EnrollmentStatus.ACTIVE);

    // 5. Complete Class B again and simulate closedAt > 7 days ago -> reopen returns 400 BadRequestException
    await request(server)
      .post(`/api/v1/classes/${classB.body.id}/complete`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ actualEndDate: '2026-12-26', reason: 'Đóng lớp hoàn tất' })
      .expect(200);

    const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
    await harness.prisma.class.update({
      where: { id: classB.body.id },
      data: { closedAt: eightDaysAgo },
    });

    await request(server)
      .post(`/api/v1/classes/${classB.body.id}/reopen`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'Thử mở lại sau 8 ngày' })
      .expect(400);
  });
});
