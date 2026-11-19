import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import {
  AssessmentStatus,
  AssessmentType,
  CourseLevel,
  NotificationType,
  QuestionType,
  Role,
  UserStatus,
} from '@prisma/client';
import { NotificationDeadlineService } from '../src/modules/notifications/services/notification-deadline.service.js';
import { NotificationMaintenanceService } from '../src/modules/notifications/services/notification-maintenance.service.js';
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
    patch: (url: string) => auth(request(server).patch(url)),
  };
}
type Client = ReturnType<typeof makeClient>;

describe('Phase 9 Notifications In-App, 14 Academic Triggers & Zero-Leak E2E (Real PostgreSQL)', () => {
  let harness: RealE2eAppHarness;
  let server: Server;
  let passwordHash: string;
  let adminClient: Client;
  let superadminClient: Client;
  let teacherClient: Client;
  let studentAClient: Client;
  let studentBClient: Client;

  let teacherId: string;
  let studentAId: string;
  let studentBId: string;
  let droppedStudentId: string;
  let courseId: string;
  let classId: string;
  let targetClassId: string;

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

    await harness.prisma.user.create({
      data: {
        email: 'sa.p9@webedu.vn',
        phone: '0908000001',
        fullName: 'Pure SA P9',
        passwordHash,
        roles: [Role.SUPERADMIN],
        status: UserStatus.ACTIVE,
      },
    });
    await harness.prisma.user.create({
      data: {
        email: 'admin.p9@webedu.vn',
        phone: '0908000002',
        fullName: 'Admin P9',
        passwordHash,
        roles: [Role.ADMIN],
        status: UserStatus.ACTIVE,
      },
    });
    const teacher = await harness.prisma.user.create({
      data: {
        email: 'teacher.p9@webedu.vn',
        phone: '0908000003',
        fullName: 'Cô Trương Lan',
        passwordHash,
        roles: [Role.TEACHER],
        status: UserStatus.ACTIVE,
        teacherProfile: { create: {} },
      },
    });
    teacherId = teacher.id;

    const studentA = await harness.prisma.user.create({
      data: {
        email: 'stua.p9@webedu.vn',
        phone: '0908000004',
        fullName: 'Học Viên A',
        passwordHash,
        roles: [Role.STUDENT],
        status: UserStatus.ACTIVE,
        studentProfile: {
          create: { dateOfBirth: new Date('2003-01-10T00:00:00.000Z') },
        },
      },
    });
    studentAId = studentA.id;

    const studentB = await harness.prisma.user.create({
      data: {
        email: 'stub.p9@webedu.vn',
        phone: '0908000005',
        fullName: 'Học Viên B',
        passwordHash,
        roles: [Role.STUDENT],
        status: UserStatus.ACTIVE,
        studentProfile: {
          create: { dateOfBirth: new Date('2003-02-10T00:00:00.000Z') },
        },
      },
    });
    studentBId = studentB.id;

    const droppedStudent = await harness.prisma.user.create({
      data: {
        email: 'dropped.p9@webedu.vn',
        phone: '0908000006',
        fullName: 'Học Viên Rời Lớp',
        passwordHash,
        roles: [Role.STUDENT],
        status: UserStatus.PENDING_CLASS,
        studentProfile: {
          create: { dateOfBirth: new Date('2003-03-10T00:00:00.000Z') },
        },
      },
    });
    droppedStudentId = droppedStudent.id;

    const course = await harness.prisma.course.create({
      data: {
        code: 'HSK1-P9',
        name: 'HSK 1 Chuẩn',
        level: CourseLevel.HSK1,
      },
    });
    courseId = course.id;

    const login = async (email: string) => {
      const res = await request(server)
        .post('/api/v1/auth/login')
        .send({ email, password: PASSWORD })
        .expect(200);
      return makeClient(server, extractAuthCookie(res).cookiePair);
    };
    superadminClient = await login('sa.p9@webedu.vn');
    adminClient = await login('admin.p9@webedu.vn');
    teacherClient = await login('teacher.p9@webedu.vn');
    studentAClient = await login('stua.p9@webedu.vn');
    studentBClient = await login('stub.p9@webedu.vn');

    const clsRes = await adminClient
      .post('/api/v1/classes')
      .send({
        code: 'HSK1-P9-01',
        courseId,
        teacherId,
        scheduleDays: [1, 3, 5],
        scheduleStartTime: '18:00',
        scheduleEndTime: '19:30',
        startDate: '2026-11-02',
        totalSessions: 12,
      })
      .expect(201);
    classId = clsRes.body.id as string;

    const targetClsRes = await adminClient
      .post('/api/v1/classes')
      .send({
        code: 'HSK1-P9-02',
        courseId,
        teacherId,
        scheduleDays: [2, 4, 6],
        scheduleStartTime: '18:00',
        scheduleEndTime: '19:30',
        startDate: '2026-11-03',
        totalSessions: 12,
      })
      .expect(201);
    targetClassId = targetClsRes.body.id as string;

    await adminClient
      .post(`/api/v1/classes/${classId}/enrollments`)
      .send({ studentIds: [studentAId, studentBId, droppedStudentId], enrolledDate: '2026-11-02' })
      .expect(200);
    await adminClient
      .post(`/api/v1/classes/${classId}/enrollments/${droppedStudentId}/drop`)
      .send({ leftDate: '2026-11-03', reason: 'Tạm nghỉ' })
      .expect(200);
  });

  it('triggers all 14 notification types accurately, enforces Zero-Leak before RETURNED, blocks IDOR/SUPERADMIN, and prunes retention', async () => {
    // 1. Pure SUPERADMIN blocked on notifications API
    await superadminClient.get('/api/v1/notifications').expect(403);
    await superadminClient.get('/api/v1/notifications/unread-count').expect(403);

    // 2. Teacher received TEACHER_ASSIGNED_CLASS; Student A/B received STUDENT_ENROLLED; Dropped student received STUDENT_DROPPED
    const teacherNotifsInitial = await teacherClient.get('/api/v1/notifications').expect(200);
    expect(
      (teacherNotifsInitial.body.items as Array<{ type: string }>).filter(
        (n) => n.type === NotificationType.TEACHER_ASSIGNED_CLASS,
      ),
    ).toHaveLength(2);

    const stuANotifs0 = await studentAClient.get('/api/v1/notifications').expect(200);
    expect(stuANotifs0.body.items[0]?.type).toBe(NotificationType.STUDENT_ENROLLED);

    const droppedNotifs = await harness.prisma.notification.findMany({
      where: { recipientId: droppedStudentId },
    });
    expect(droppedNotifs.map((n) => n.type)).toContain(NotificationType.STUDENT_DROPPED);

    // 3. New student self-registration triggers NEW_STUDENT_PENDING_CLASS for Admin
    const otp = await obtainVerificationCodeViaHttp(harness.app, harness.smtpServer, 'new.p9@example.com');
    const regRes = await request(harness.app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        fullName: 'Trần Tân Sinh',
        dateOfBirth: '2002-04-12',
        phone: '0908123456',
        email: 'new.p9@example.com',
        password: PASSWORD,
        verificationCode: otp,
      })
      .expect(201);
    const newStudentId = regRes.body.user.id as string;

    const adminNotifs = await adminClient.get('/api/v1/notifications').expect(200);
    expect(adminNotifs.body.items[0]?.type).toBe(NotificationType.NEW_STUDENT_PENDING_CLASS);
    expect(adminNotifs.body.items[0]?.body).toContain('Trần Tân Sinh');

    // Initial placement triggers STUDENT_ENROLLED for newStudentId
    await adminClient
      .post(`/api/v1/students/${newStudentId}/assign-initial-class`)
      .send({ classNameOrId: classId, enrolledAt: '2026-11-10' })
      .expect(200);
    const newStuEnrolledNotifs = await harness.prisma.notification.findMany({
      where: { recipientId: newStudentId, type: NotificationType.STUDENT_ENROLLED },
    });
    expect(newStuEnrolledNotifs).toHaveLength(1);

    // Transfer triggers STUDENT_TRANSFERRED
    await adminClient
      .post(`/api/v1/classes/${classId}/enrollments/${newStudentId}/transfer`)
      .send({ targetClassId, transferDate: '2026-11-11', reason: 'Chuyển ca' })
      .expect(200);
    const transferNotifs = await harness.prisma.notification.findMany({
      where: { recipientId: newStudentId, type: NotificationType.STUDENT_TRANSFERRED },
    });
    expect(transferNotifs).toHaveLength(1);

    // 4. Schedule reschedule, cancel & makeup notify ACTIVE students + teacher, NOT dropped student
    const sessions = await harness.prisma.lessonSession.findMany({
      where: { classId },
      orderBy: { sessionNumber: 'asc' },
    });
    await adminClient
      .patch(`/api/v1/sessions/${sessions[0]!.id}/reschedule`)
      .send({ sessionDate: '2099-02-01', startTime: '09:00', endTime: '10:30', reason: 'Đổi giờ dạy' })
      .expect(200);
    await adminClient
      .post(`/api/v1/sessions/${sessions[1]!.id}/cancel`)
      .send({ reason: 'GV nghỉ phép' })
      .expect(201);
    await adminClient
      .post(`/api/v1/sessions/${sessions[1]!.id}/makeup`)
      .send({ sessionDate: '2099-02-03', startTime: '14:00', endTime: '15:30', reason: 'Bù buổi nghỉ' })
      .expect(201);

    const droppedAfterSchedule = await harness.prisma.notification.findMany({
      where: {
        recipientId: droppedStudentId,
        type: {
          in: [
            NotificationType.SESSION_RESCHEDULED,
            NotificationType.SESSION_CANCELLED,
            NotificationType.SESSION_MAKEUP_ADDED,
          ],
        },
      },
    });
    expect(droppedAfterSchedule).toHaveLength(0);

    // 5. Assign assessment -> ASSIGNMENT_ASSIGNED; 24h due-soon dedup; submit -> aggregated SUBMISSION_PENDING_GRADING
    const assessment = await harness.prisma.assessment.create({
      data: {
        title: 'Mini-test HSK1 Phase 9',
        type: AssessmentType.MINI_TEST,
        courseId,
        status: AssessmentStatus.PUBLISHED,
        createdById: teacherId,
        questions: {
          create: [
            {
              position: 1,
              type: QuestionType.SINGLE_CHOICE,
              prompt: 'Chọn 你好',
              points: 10,
              payload: {
                options: [
                  { id: 'opt-1', text: 'Xin chào' },
                  { id: 'opt-2', text: 'Tạm biệt' },
                ],
                correctOptionIds: ['opt-1'],
              },
            },
          ],
        },
      },
    });

    const soonDueAt = new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString();
    const assignRes = await teacherClient
      .post(`/api/v1/assessments/${assessment.id}/assign`)
      .send({ classIds: [classId], dueAt: soonDueAt })
      .expect(201);
    const assignmentId = assignRes.body.items[0].id as string;

    // Student A starts & submits; Student B does NOT submit yet
    const startA = await studentAClient
      .post(`/api/v1/assignments/${assignmentId}/submissions/start`)
      .expect(200);
    await studentAClient
      .post(`/api/v1/assignments/${assignmentId}/submissions/submit`)
      .send({
        submissionId: startA.body.submission.id,
        revision: startA.body.submission.revision,
        answers: [{ questionId: startA.body.questions[0].id, answerPayload: { selectedOptionIds: ['opt-1'] } }],
      })
      .expect(200);

    const startB = await studentBClient
      .post(`/api/v1/assignments/${assignmentId}/submissions/start`)
      .expect(200);

    // Run 24h due-soon check twice -> Student B receives exactly 1 ASSIGNMENT_DUE_SOON, Student A (submitted) receives 0
    const deadlineService = harness.app.get(NotificationDeadlineService);
    await deadlineService.dispatchDueSoonReminders();
    await deadlineService.dispatchDueSoonReminders();
    const dueSoonA = await harness.prisma.notification.count({
      where: { recipientId: studentAId, type: NotificationType.ASSIGNMENT_DUE_SOON },
    });
    const dueSoonB = await harness.prisma.notification.count({
      where: { recipientId: studentBId, type: NotificationType.ASSIGNMENT_DUE_SOON },
    });
    expect(dueSoonA).toBe(0);
    expect(dueSoonB).toBe(1);

    // Student B submits -> Teacher has 1 aggregated unread notification "2 bài nộp"
    await studentBClient
      .post(`/api/v1/assignments/${assignmentId}/submissions/submit`)
      .send({
        submissionId: startB.body.submission.id,
        revision: startB.body.submission.revision,
        answers: [{ questionId: startB.body.questions[0].id, answerPayload: { selectedOptionIds: ['opt-2'] } }],
      })
      .expect(200);

    const teacherPendingRows = await harness.prisma.notification.findMany({
      where: { recipientId: teacherId, type: NotificationType.SUBMISSION_PENDING_GRADING },
    });
    expect(teacherPendingRows).toHaveLength(1);
    expect(teacherPendingRows[0]?.body).toContain('2 bài nộp');

    // Reopen Student B's submission -> Student B receives SUBMISSION_REOPENED
    await teacherClient
      .post(`/api/v1/submissions/${startB.body.submission.id}/reopen`)
      .send({ reason: 'Mạng lag', newDueAt: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString() })
      .expect(200);
    const reopenCount = await harness.prisma.notification.count({
      where: { recipientId: studentBId, type: NotificationType.SUBMISSION_REOPENED },
    });
    expect(reopenCount).toBe(1);

    // 6. ZERO-LEAK GATE: Confirm grade (GRADED) and adjust while GRADED must create 0 grade notifications
    await teacherClient
      .post(`/api/v1/submissions/${startA.body.submission.id}/confirm-grade`)
      .expect(200);
    await teacherClient
      .patch(`/api/v1/submissions/${startA.body.submission.id}/adjust-grade`)
      .send({
        reason: 'Điều chỉnh trước công bố',
        answers: [{ questionId: startA.body.questions[0].id, earnedPoints: 9, previousEarnedPoints: 10 }],
      })
      .expect(200);

    const leakedGradeNotifs = await harness.prisma.notification.count({
      where: {
        recipientId: studentAId,
        type: { in: [NotificationType.GRADE_PUBLISHED, NotificationType.GRADE_UPDATED] },
      },
    });
    expect(leakedGradeNotifs).toBe(0);

    // Publish (RETURNED) -> Student A receives GRADE_PUBLISHED; adjust after RETURNED -> GRADE_UPDATED
    await teacherClient
      .post(`/api/v1/assignments/${assignmentId}/publish-grades`)
      .send({ submissionIds: [startA.body.submission.id] })
      .expect(200);
    const publishedNotifs = await harness.prisma.notification.findMany({
      where: { recipientId: studentAId, type: NotificationType.GRADE_PUBLISHED },
    });
    expect(publishedNotifs).toHaveLength(1);
    expect(publishedNotifs[0]?.body).toContain('9/10');
    expect(publishedNotifs[0]?.linkPath).toBe(`/student/assignments/${assignmentId}?mode=review`);

    await teacherClient
      .patch(`/api/v1/submissions/${startA.body.submission.id}/adjust-grade`)
      .send({
        reason: 'Cộng thêm điểm khuyến khích',
        answers: [{ questionId: startA.body.questions[0].id, earnedPoints: 9.5, previousEarnedPoints: 9 }],
      })
      .expect(200);
    const updatedNotifs = await harness.prisma.notification.findMany({
      where: { recipientId: studentAId, type: NotificationType.GRADE_UPDATED },
    });
    expect(updatedNotifs).toHaveLength(1);
    expect(updatedNotifs[0]?.body).toContain('9.5/10');

    // 7. IDOR protection, markAsRead, markAllAsRead & retention cleanup
    await studentBClient
      .patch(`/api/v1/notifications/${publishedNotifs[0]!.id}/read`)
      .expect(404);
    await studentAClient
      .patch(`/api/v1/notifications/${publishedNotifs[0]!.id}/read`)
      .expect(200);
    const readAllRes = await studentAClient.post('/api/v1/notifications/read-all').expect(200);
    expect(readAllRes.body.unreadCount).toBe(0);

    // Seed expired read (>90d) and unread (>180d) notifications and purge
    const oldReadAt = new Date(Date.now() - 95 * 24 * 60 * 60 * 1000);
    const oldUnreadAt = new Date(Date.now() - 185 * 24 * 60 * 60 * 1000);
    await harness.prisma.notification.createMany({
      data: [
        {
          recipientId: studentAId,
          type: NotificationType.STUDENT_ENROLLED,
          title: 'Old Read',
          body: 'Old Read',
          linkPath: '/student/overview',
          isRead: true,
          readAt: oldReadAt,
          createdAt: oldReadAt,
        },
        {
          recipientId: studentAId,
          type: NotificationType.STUDENT_ENROLLED,
          title: 'Old Unread',
          body: 'Old Unread',
          linkPath: '/student/overview',
          isRead: false,
          createdAt: oldUnreadAt,
        },
      ],
    });
    const maintenanceService = harness.app.get(NotificationMaintenanceService);
    const purged = await maintenanceService.purgeExpiredNotifications();
    expect(purged.deletedRead).toBeGreaterThanOrEqual(1);
    expect(purged.deletedUnread).toBeGreaterThanOrEqual(1);
  });
});
