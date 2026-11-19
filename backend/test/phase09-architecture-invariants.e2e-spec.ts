import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import {
  AssessmentStatus,
  AssessmentType,
  AttendanceStatus,
  ClassStatus,
  CourseLevel,
  EnrollmentStatus,
  NotificationType,
  QuestionType,
  Role,
  SessionStatus,
  SubmissionStatus,
  UserStatus,
} from '@prisma/client';
import { formatIsoDateUtc, resolveVnToday } from '../src/common/utils/timezone.util.js';
import {
  createRealE2eAppHarness,
  extractAuthCookie,
  type RealE2eAppHarness,
} from './helpers/e2e-app-harness.js';
import { obtainVerificationCodeViaHttp } from './helpers/auth-test-helpers.js';

const ORIGIN = 'http://localhost:3000';
const PASSWORD = 'Password123!';

type Server = Parameters<typeof request>[0];

function makeClient(server: Server, cookie: string) {
  const auth = (req: request.Test) => req.set('Cookie', [cookie]).set('Origin', ORIGIN);
  return {
    get: (url: string) => auth(request(server).get(url)),
    post: (url: string) => auth(request(server).post(url)),
    put: (url: string) => auth(request(server).put(url)),
    patch: (url: string) => auth(request(server).patch(url)),
  };
}
type Client = ReturnType<typeof makeClient>;

async function loginAs(server: Server, email: string, password = PASSWORD): Promise<Client> {
  const res = await request(server)
    .post('/api/v1/auth/login')
    .set('Origin', ORIGIN)
    .send({ email, password })
    .expect(200);
  return makeClient(server, extractAuthCookie(res).cookiePair);
}

describe('Phase 9 — 5 Architecture Invariants Verification (Real PostgreSQL)', () => {
  let harness: RealE2eAppHarness;
  let server: Server;
  let passwordHash: string;

  beforeAll(async () => {
    harness = await createRealE2eAppHarness();
    server = harness.app.getHttpServer();
    passwordHash = await bcrypt.hash(PASSWORD, 10);
  });

  afterAll(async () => {
    await harness?.stop();
  });

  beforeEach(async () => {
    await harness.resetState();
  });

  it('Invariant 1: enforces max 1 ACTIVE class concurrently (Partial Unique Index) and preserves transfer/drop history', async () => {
    const admin = await harness.prisma.user.create({
      data: {
        email: 'admin.inv1@webedu.vn',
        phone: '0901000001',
        fullName: 'Admin Inv1',
        passwordHash,
        roles: [Role.ADMIN],
        status: UserStatus.ACTIVE,
      },
    });
    const teacher = await harness.prisma.user.create({
      data: {
        email: 'teacher.inv1@webedu.vn',
        phone: '0901000002',
        fullName: 'Teacher Inv1',
        passwordHash,
        roles: [Role.TEACHER],
        status: UserStatus.ACTIVE,
        teacherProfile: { create: {} },
      },
    });
    const student = await harness.prisma.user.create({
      data: {
        email: 'student.inv1@webedu.vn',
        phone: '0901000003',
        fullName: 'Student Inv1',
        passwordHash,
        roles: [Role.STUDENT],
        status: UserStatus.PENDING_CLASS,
        studentProfile: { create: { dateOfBirth: new Date('2002-01-01T00:00:00.000Z') } },
      },
    });

    const todayVn = resolveVnToday();
    const todayYmd = formatIsoDateUtc(todayVn);
    const pastDate = new Date(todayVn.getTime() - 10 * 24 * 60 * 60 * 1000);
    const pastYmd = formatIsoDateUtc(pastDate);

    const course = await harness.prisma.course.create({
      data: { code: 'HSK1', name: 'HSK 1 Inv1', level: CourseLevel.HSK1 },
    });
    const class1 = await harness.prisma.class.create({
      data: {
        code: 'INV1-C1',
        courseId: course.id,
        teacherId: teacher.id,
        status: ClassStatus.ACTIVE,
        startDate: pastDate,
        totalSessions: 4,
      },
    });
    const class2 = await harness.prisma.class.create({
      data: {
        code: 'INV1-C2',
        courseId: course.id,
        teacherId: teacher.id,
        status: ClassStatus.ACTIVE,
        startDate: pastDate,
        totalSessions: 4,
      },
    });
    expect(admin.id).toBeTruthy();

    const adminClient = await loginAs(server, 'admin.inv1@webedu.vn');
    const [r1, r2] = await Promise.all([
      adminClient
        .post(`/api/v1/classes/${class1.id}/enrollments`)
        .send({ studentIds: [student.id], enrolledDate: pastYmd }),
      adminClient
        .post(`/api/v1/classes/${class2.id}/enrollments`)
        .send({ studentIds: [student.id], enrolledDate: pastYmd }),
    ]);

    const statuses = [r1.status, r2.status].sort((a, b) => a - b);
    expect(statuses).toEqual([200, 409]);

    const activeEnrollments = await harness.prisma.enrollment.findMany({
      where: { studentId: student.id, status: EnrollmentStatus.ACTIVE },
    });
    expect(activeEnrollments).toHaveLength(1);
    const firstActiveClassId = activeEnrollments[0]!.classId;
    const otherClassId = firstActiveClassId === class1.id ? class2.id : class1.id;

    // DB-level Partial Unique Index guard must reject second ACTIVE row directly
    await expect(
      harness.prisma.enrollment.create({
        data: {
          studentId: student.id,
          classId: otherClassId,
          status: EnrollmentStatus.ACTIVE,
          enrolledDate: pastDate,
        },
      }),
    ).rejects.toThrow();

    // Transfer preserves TRANSFERRED + adds ACTIVE; Drop marks DROPPED while preserving full history
    await adminClient
      .post(`/api/v1/classes/${firstActiveClassId}/enrollments/${student.id}/transfer`)
      .send({ targetClassId: otherClassId, transferDate: todayYmd, reason: 'Chuyển ca tối' })
      .expect(200);

    await adminClient
      .post(`/api/v1/classes/${otherClassId}/enrollments/${student.id}/drop`)
      .send({ leftDate: todayYmd, reason: 'Bảo lưu' })
      .expect(200);

    const history = await harness.prisma.enrollment.findMany({
      where: { studentId: student.id },
      orderBy: { createdAt: 'asc' },
    });
    expect(history).toHaveLength(2);
    expect(history.map((e) => e.status)).toEqual([
      EnrollmentStatus.TRANSFERRED,
      EnrollmentStatus.DROPPED,
    ]);
  });

  it('Invariant 2: enforces immutable guardian_consents, blocks <16 email change, preserves history >=16, and allows sibling email sharing', async () => {
    const vnYear = resolveVnToday().getUTCFullYear();
    const sharedParentEmail = 'parent.shared.p9@example.com';

    // Under-16 student S1 registers with parent email & consent
    const otp1 = await obtainVerificationCodeViaHttp(harness.app, harness.smtpServer, sharedParentEmail);
    const reg1 = await request(server)
      .post('/api/v1/auth/register')
      .send({
        fullName: 'Nguyễn Bảo Nhi (15t)',
        dateOfBirth: `${vnYear - 15}-05-10`,
        phone: '0902000001',
        email: sharedParentEmail,
        password: PASSWORD,
        verificationCode: otp1,
        guardianConsent: true,
      })
      .expect(201);
    const student1Id = reg1.body.user.id as string;

    const consentRows1 = await harness.prisma.guardianConsent.findMany({
      where: { guardianEmail: sharedParentEmail },
    });
    expect(consentRows1).toHaveLength(1);
    const originalConsentId = consentRows1[0]!.id;

    // Raw SQL trigger must forbid both UPDATE and DELETE on guardian_consents
    await expect(
      harness.prisma.$executeRawUnsafe(
        `UPDATE "guardian_consents" SET "guardian_email" = 'tamper@example.com' WHERE id = '${originalConsentId}'`,
      ),
    ).rejects.toThrow(/guardian_consents records are immutable/);
    await expect(
      harness.prisma.$executeRawUnsafe(
        `DELETE FROM "guardian_consents" WHERE id = '${originalConsentId}'`,
      ),
    ).rejects.toThrow(/guardian_consents records are immutable/);

    // Under-16 cannot initiate self email change (403)
    const s1Client = await loginAs(server, sharedParentEmail);
    await s1Client
      .post('/api/v1/profile/me/send-email-change-code')
      .send({ newEmail: 'nhi.own16@example.com' })
      .expect(403);

    // Simulate S1 turning 16+ -> self email change with OTP succeeds & preserves guardian_consents history
    await harness.prisma.studentProfile.update({
      where: { userId: student1Id },
      data: { dateOfBirth: new Date(`${vnYear - 16}-01-01T00:00:00.000Z`) },
    });
    await s1Client
      .post('/api/v1/profile/me/send-email-change-code')
      .send({ newEmail: 'nhi.own16@example.com' })
      .expect(200);
    const otpEmailChangeMsg = harness.smtpServer.getLatestMessageFor('nhi.own16@example.com');
    expect(otpEmailChangeMsg).toBeDefined();
    const emailChangeOtp = harness.smtpServer.extractVerificationCodeFromMessage(otpEmailChangeMsg!)!;

    await s1Client
      .patch('/api/v1/profile/me')
      .send({
        email: 'nhi.own16@example.com',
        currentPassword: PASSWORD,
        verificationCode: emailChangeOtp,
      })
      .expect(200);

    const preservedConsent = await harness.prisma.guardianConsent.findUnique({
      where: { id: originalConsentId },
    });
    expect(preservedConsent?.guardianEmail).toBe(sharedParentEmail);

    // Younger under-16 sibling registers using the same parent email -> 2 guardian_consents rows share guardian_email
    await harness.prisma.emailRateLimit.deleteMany({});
    const otp2 = await obtainVerificationCodeViaHttp(harness.app, harness.smtpServer, sharedParentEmail);
    await request(server)
      .post('/api/v1/auth/register')
      .send({
        fullName: 'Nguyễn Gia Bảo (13t)',
        dateOfBirth: `${vnYear - 13}-06-15`,
        phone: '0902000002',
        email: sharedParentEmail,
        password: PASSWORD,
        verificationCode: otp2,
        guardianConsent: true,
      })
      .expect(201);

    const sharedConsents = await harness.prisma.guardianConsent.findMany({
      where: { guardianEmail: sharedParentEmail },
    });
    expect(sharedConsents).toHaveLength(2);
  });

  it('Invariant 3 & 4: enforces Teacher GMT+7 T+2 attendance window, Admin/Dual-Role override, and Attendance/Grade/System Audit Logs', async () => {
    await harness.prisma.user.create({
      data: {
        email: 'admin.inv34@webedu.vn',
        phone: '0903000001',
        fullName: 'Pure Admin Inv34',
        passwordHash,
        roles: [Role.ADMIN],
        status: UserStatus.ACTIVE,
      },
    });
    const teacher = await harness.prisma.user.create({
      data: {
        email: 'teacher.inv34@webedu.vn',
        phone: '0903000002',
        fullName: 'Pure Teacher Inv34',
        passwordHash,
        roles: [Role.TEACHER],
        status: UserStatus.ACTIVE,
        teacherProfile: { create: {} },
      },
    });
    const dualUser = await harness.prisma.user.create({
      data: {
        email: 'dual.inv34@webedu.vn',
        phone: '0903000003',
        fullName: 'Dual Admin Teacher Inv34',
        passwordHash,
        roles: [Role.ADMIN, Role.TEACHER],
        status: UserStatus.ACTIVE,
        teacherProfile: { create: {} },
      },
    });
    const student = await harness.prisma.user.create({
      data: {
        email: 'student.inv34@webedu.vn',
        phone: '0903000004',
        fullName: 'Student Inv34',
        passwordHash,
        roles: [Role.STUDENT],
        status: UserStatus.ACTIVE,
        studentProfile: { create: { dateOfBirth: new Date('2001-03-03T00:00:00.000Z') } },
      },
    });

    const todayVn = resolveVnToday();
    const dayMs = 24 * 60 * 60 * 1000;
    const enrolledDate = new Date(todayVn.getTime() - 10 * dayMs);
    const t1Date = new Date(todayVn.getTime() - 1 * dayMs);
    const t3Date = new Date(todayVn.getTime() - 3 * dayMs);

    const course = await harness.prisma.course.create({
      data: { code: 'HSK2', name: 'HSK 2 Inv34', level: CourseLevel.HSK2 },
    });
    const cls = await harness.prisma.class.create({
      data: {
        code: 'INV34-C1',
        courseId: course.id,
        teacherId: teacher.id,
        status: ClassStatus.ACTIVE,
        startDate: enrolledDate,
        totalSessions: 2,
      },
    });
    await harness.prisma.enrollment.create({
      data: {
        studentId: student.id,
        classId: cls.id,
        status: EnrollmentStatus.ACTIVE,
        enrolledDate,
      },
    });

    const sessionT1 = await harness.prisma.lessonSession.create({
      data: {
        classId: cls.id,
        sessionNumber: 1,
        sessionDate: t1Date,
        startTime: '18:00',
        endTime: '19:30',
        status: SessionStatus.COMPLETED,
        attendanceMarkedById: teacher.id,
        attendanceMarkedAt: t1Date,
      },
    });
    const sessionT3 = await harness.prisma.lessonSession.create({
      data: {
        classId: cls.id,
        sessionNumber: 2,
        sessionDate: t3Date,
        startTime: '18:00',
        endTime: '19:30',
        status: SessionStatus.COMPLETED,
        attendanceMarkedById: teacher.id,
        attendanceMarkedAt: t3Date,
      },
    });
    await harness.prisma.attendanceRecord.createMany({
      data: [
        { sessionId: sessionT1.id, classId: cls.id, studentId: student.id, status: AttendanceStatus.PRESENT, markedById: teacher.id, markedAt: t1Date },
        { sessionId: sessionT3.id, classId: cls.id, studentId: student.id, status: AttendanceStatus.PRESENT, markedById: teacher.id, markedAt: t3Date },
      ],
    });

    const teacherClient = await loginAs(server, 'teacher.inv34@webedu.vn');
    const adminClient = await loginAs(server, 'admin.inv34@webedu.vn');
    const dualClient = await loginAs(server, 'dual.inv34@webedu.vn');

    // Teacher can edit T+1 (within T+2 GMT+7)
    await teacherClient
      .put(`/api/v1/sessions/${sessionT1.id}/attendance`)
      .send({
        records: [{ studentId: student.id, status: AttendanceStatus.ABSENT }],
        reason: 'Sửa trong hạn T+2',
      })
      .expect(200);

    // Teacher is blocked (403) editing T+3 attendance past GMT+7 window
    await teacherClient
      .put(`/api/v1/sessions/${sessionT3.id}/attendance`)
      .send({
        records: [{ studentId: student.id, status: AttendanceStatus.ABSENT }],
        reason: 'Sửa quá hạn',
      })
      .expect(403);

    // Admin overrides T+3 attendance -> 200 & AttendanceAuditLog(isAdminOverride=true)
    await adminClient
      .put(`/api/v1/sessions/${sessionT3.id}/attendance`)
      .send({
        records: [{ studentId: student.id, status: AttendanceStatus.EXCUSED }],
        reason: 'Admin điều chỉnh do có giấy xin phép muộn',
      })
      .expect(200);

    // Invariant 4: Dual-role ADMIN + TEACHER keeps merged ADMIN privilege on T+3 override & published grade adjustment
    await dualClient
      .put(`/api/v1/sessions/${sessionT3.id}/attendance`)
      .send({
        records: [{ studentId: student.id, status: AttendanceStatus.ABSENT }],
        reason: 'Admin kiêm GV hiệu chỉnh lại vắng mặt',
      })
      .expect(200);

    const attAudits = await harness.prisma.attendanceAuditLog.findMany({
      where: { sessionId: sessionT3.id, actorId: dualUser.id },
    });
    expect(attAudits).toHaveLength(1);
    expect(attAudits[0]?.actorRole).toBe(Role.ADMIN);
    expect(attAudits[0]?.isAdminOverride).toBe(true);

    // Published grade adjusted by dualUser writes GradeAuditLog + SystemAuditLog(actingRole: ADMIN)
    const assessment = await harness.prisma.assessment.create({
      data: {
        title: 'Midterm Inv4',
        type: AssessmentType.MIDTERM,
        courseId: course.id,
        status: AssessmentStatus.PUBLISHED,
        createdById: teacher.id,
        questions: {
          create: [
            {
              position: 1,
              type: QuestionType.SINGLE_CHOICE,
              prompt: 'Q1',
              points: 10,
              payload: { options: [{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }], correctOptionIds: ['a'] },
            },
          ],
        },
      },
      include: { questions: true },
    });
    const classAssignment = await harness.prisma.classAssignment.create({
      data: {
        assessmentId: assessment.id,
        classId: cls.id,
        assignedById: teacher.id,
        dueAt: new Date(Date.now() + dayMs),
      },
    });
    const sub = await harness.prisma.submission.create({
      data: {
        classAssignmentId: classAssignment.id,
        studentId: student.id,
        attemptNumber: 1,
        status: SubmissionStatus.RETURNED,
        submittedAt: todayVn,
        returnedAt: todayVn,
        autoScore: 8,
        totalScore: 8,
        answers: {
          create: [{ questionId: assessment.questions[0]!.id, answerPayload: { selectedOptionIds: ['a'] }, isCorrect: true, earnedPoints: 8 }],
        },
      },
    });

    await dualClient
      .patch(`/api/v1/submissions/${sub.id}/adjust-grade`)
      .send({
        reason: 'Phúc khảo điểm giữa kỳ',
        answers: [{ questionId: assessment.questions[0]!.id, earnedPoints: 9, previousEarnedPoints: 8 }],
      })
      .expect(200);

    const gradeAudits = await harness.prisma.gradeAuditLog.findMany({ where: { submissionId: sub.id } });
    expect(gradeAudits.length).toBeGreaterThanOrEqual(1);
    const sysAudit = await harness.prisma.systemAuditLog.findFirst({
      where: { action: 'SUBMISSION_GRADE_ADJUSTED', targetId: sub.id, actorId: dualUser.id },
    });
    expect(sysAudit?.actingRole).toBe(Role.ADMIN);
  });

  it('Invariant 5: enforces Zero-Leak unpublished grades/notifications and excludes BTVN from final weighted score', async () => {
    const teacher = await harness.prisma.user.create({
      data: {
        email: 'teacher.inv5@webedu.vn',
        phone: '0905000001',
        fullName: 'Teacher Inv5',
        passwordHash,
        roles: [Role.TEACHER],
        status: UserStatus.ACTIVE,
        teacherProfile: { create: {} },
      },
    });
    const student = await harness.prisma.user.create({
      data: {
        email: 'student.inv5@webedu.vn',
        phone: '0905000002',
        fullName: 'Student Inv5',
        passwordHash,
        roles: [Role.STUDENT],
        status: UserStatus.ACTIVE,
        studentProfile: { create: { dateOfBirth: new Date('2002-07-07T00:00:00.000Z') } },
      },
    });

    const todayVn = resolveVnToday();
    const course = await harness.prisma.course.create({
      data: {
        code: 'HSK2',
        name: 'HSK 2 Inv5',
        level: CourseLevel.HSK2,
        miniTestWeight: 30,
        midtermWeight: 20,
        finalWeight: 50,
        passingScore: 5.5,
      },
    });
    const cls = await harness.prisma.class.create({
      data: {
        code: 'INV5-C1',
        courseId: course.id,
        teacherId: teacher.id,
        status: ClassStatus.ACTIVE,
        startDate: todayVn,
        totalSessions: 4,
      },
    });
    await harness.prisma.enrollment.create({
      data: { studentId: student.id, classId: cls.id, status: EnrollmentStatus.ACTIVE, enrolledDate: todayVn },
    });

    const mkAssessment = async (title: string, type: AssessmentType) =>
      harness.prisma.assessment.create({
        data: {
          title,
          type,
          courseId: course.id,
          status: AssessmentStatus.PUBLISHED,
          createdById: teacher.id,
          questions: {
            create: [
              {
                position: 1,
                type: QuestionType.SINGLE_CHOICE,
                prompt: `${title} Q1`,
                points: 10,
                payload: { options: [{ id: 'a', text: 'Đúng' }, { id: 'b', text: 'Sai' }], correctOptionIds: ['a'] },
              },
            ],
          },
        },
        include: { questions: true },
      });

    const miniTest = await mkAssessment('Mini-test Inv5', AssessmentType.MINI_TEST);
    const hw = await mkAssessment('BTVN Inv5', AssessmentType.HOMEWORK);

    const teacherClient = await loginAs(server, 'teacher.inv5@webedu.vn');
    const studentClient = await loginAs(server, 'student.inv5@webedu.vn');

    const dueAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
    const miniAssignRes = await teacherClient
      .post(`/api/v1/assessments/${miniTest.id}/assign`)
      .send({ classIds: [cls.id], dueAt })
      .expect(201);
    const miniAssignId = miniAssignRes.body.items[0].id as string;

    const hwAssignRes = await teacherClient
      .post(`/api/v1/assessments/${hw.id}/assign`)
      .send({ classIds: [cls.id], dueAt })
      .expect(201);
    const hwAssignId = hwAssignRes.body.items[0].id as string;

    // Student gets 10/10 on Mini-test and 0/10 on Homework
    const startMini = await studentClient.post(`/api/v1/assignments/${miniAssignId}/submissions/start`).expect(200);
    await studentClient
      .post(`/api/v1/assignments/${miniAssignId}/submissions/submit`)
      .send({
        submissionId: startMini.body.submission.id,
        revision: startMini.body.submission.revision,
        answers: [{ questionId: miniTest.questions[0]!.id, answerPayload: { selectedOptionIds: ['a'] } }],
      })
      .expect(200);

    const startHw = await studentClient.post(`/api/v1/assignments/${hwAssignId}/submissions/start`).expect(200);
    await studentClient
      .post(`/api/v1/assignments/${hwAssignId}/submissions/submit`)
      .send({
        submissionId: startHw.body.submission.id,
        revision: startHw.body.submission.revision,
        answers: [{ questionId: hw.questions[0]!.id, answerPayload: { selectedOptionIds: ['b'] } }],
      })
      .expect(200);

    // Teacher confirms both (GRADED) and publishes ONLY HOMEWORK -> MINI_TEST must still NOT leak anywhere
    await teacherClient.post(`/api/v1/submissions/${startMini.body.submission.id}/confirm-grade`).expect(200);
    await teacherClient.post(`/api/v1/submissions/${startHw.body.submission.id}/confirm-grade`).expect(200);
    await teacherClient
      .post(`/api/v1/assignments/${hwAssignId}/publish-grades`)
      .send({ submissionIds: [startHw.body.submission.id] })
      .expect(200);

    const unpublishedResult = await studentClient
      .get(`/api/v1/assignments/${miniAssignId}/published-result`)
      .expect(200);
    expect(unpublishedResult.body.isPublished).toBe(false);
    expect(unpublishedResult.body.result).toBeNull();

    const progressBeforePublish = await studentClient.get('/api/v1/progress/me').expect(200);
    expect(progressBeforePublish.body.academicSummary.miniTestAvg).toBeNull();
    expect(progressBeforePublish.body.academicSummary.homeworkStats.averageScore10).toBe(0);
    expect(progressBeforePublish.body.academicSummary.finalScore).toBeNull();
    expect(progressBeforePublish.body.publishedResults.map((r: { assignmentId: string }) => r.assignmentId)).toEqual([
      hwAssignId,
    ]);

    const miniPubNotifsBefore = await harness.prisma.notification.count({
      where: {
        recipientId: student.id,
        type: NotificationType.GRADE_PUBLISHED,
        linkPath: `/student/assignments/${miniAssignId}?mode=review`,
      },
    });
    expect(miniPubNotifsBefore).toBe(0);

    // Now publish MINI_TEST -> becomes visible, triggers exact 1 notification, BTVN remains excluded from finalScore
    await teacherClient
      .post(`/api/v1/assignments/${miniAssignId}/publish-grades`)
      .send({ submissionIds: [startMini.body.submission.id] })
      .expect(200);

    const publishedResult = await studentClient
      .get(`/api/v1/assignments/${miniAssignId}/published-result`)
      .expect(200);
    expect(publishedResult.body.isPublished).toBe(true);
    expect(publishedResult.body.result.totalScore).toBe(10);

    const progressAfterPublish = await studentClient.get('/api/v1/progress/me').expect(200);
    expect(progressAfterPublish.body.academicSummary.miniTestAvg).toBe(10);
    expect(progressAfterPublish.body.academicSummary.homeworkStats.averageScore10).toBe(0);
    expect(progressAfterPublish.body.academicSummary.finalScore).toBeNull();

    const miniPubNotifsAfter = await harness.prisma.notification.count({
      where: {
        recipientId: student.id,
        type: NotificationType.GRADE_PUBLISHED,
        linkPath: `/student/assignments/${miniAssignId}?mode=review`,
      },
    });
    expect(miniPubNotifsAfter).toBe(1);
  });
});
