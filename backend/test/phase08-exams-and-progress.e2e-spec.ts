import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import {
  AssessmentType,
  AttendanceStatus,
  ClassStatus,
  CourseLevel,
  EnrollmentStatus,
  Role,
  SessionStatus,
  SessionType,
  UserStatus,
} from '@prisma/client';
import { resolveVnToday } from '../src/common/utils/timezone.util.js';
import {
  createRealE2eAppHarness,
  extractAuthCookie,
  type RealE2eAppHarness,
} from './helpers/e2e-app-harness.js';

const ORIGIN = 'http://localhost:3000';
const PASSWORD = 'Password123';

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

function toVnOffsetIso(date: Date): string {
  const vnDate = new Date(date.getTime() + 7 * 60 * 60 * 1000);
  return `${vnDate.toISOString().slice(0, 19)}+07:00`;
}

describe('Phase 8 Dynamic Course Weights, Zero-Leak Progress & Admin Overview E2E (Real PostgreSQL)', () => {
  let harness: RealE2eAppHarness;
  let server: Server;
  let passwordHash: string;

  let superadminClient: Client;
  let adminClient: Client;
  let teacherClient: Client;
  let otherTeacherClient: Client;
  let studentAClient: Client;
  let studentBClient: Client;

  let teacherId: string;
  let otherTeacherId: string;
  let studentAId: string;
  let studentBId: string;

  beforeAll(async () => {
    passwordHash = await bcrypt.hash(PASSWORD, 10);
    harness = await createRealE2eAppHarness();
    server = harness.app.getHttpServer() as Server;
  });

  afterAll(async () => {
    if (harness) await harness.stop();
  });

  async function seedAndLoginUser(
    email: string,
    roles: Role[],
    phone: string,
    fullName: string,
    status: UserStatus = UserStatus.ACTIVE,
  ): Promise<{ id: string; client: Client }> {
    const user = await harness.prisma.user.create({
      data: {
        email,
        phone,
        fullName,
        passwordHash,
        roles,
        status,
        ...(roles.includes(Role.TEACHER) ? { teacherProfile: { create: {} } } : {}),
        ...(roles.includes(Role.STUDENT)
          ? {
              studentProfile: {
                create: { dateOfBirth: new Date('2004-05-10T00:00:00.000Z') },
              },
            }
          : {}),
      },
    });
    const loginRes = await request(server)
      .post('/api/v1/auth/login')
      .send({ email, password: PASSWORD })
      .expect(200);
    return { id: user.id, client: makeClient(server, extractAuthCookie(loginRes).cookiePair) };
  }

  beforeEach(async () => {
    await harness.resetState();

    const sa = await seedAndLoginUser('sa.p8@webedu.vn', [Role.SUPERADMIN], '0908000001', 'Super Admin P8');
    const admin = await seedAndLoginUser('admin.p8@webedu.vn', [Role.ADMIN], '0908000002', 'Học Vụ P8');
    const teacher = await seedAndLoginUser('gv1.p8@webedu.vn', [Role.TEACHER], '0908000003', 'Cô Lan');
    const otherTeacher = await seedAndLoginUser('gv2.p8@webedu.vn', [Role.TEACHER], '0908000004', 'Thầy Minh');
    const stuA = await seedAndLoginUser('hva.p8@webedu.vn', [Role.STUDENT], '0908000005', 'Nguyễn Văn An');
    const stuB = await seedAndLoginUser('hvb.p8@webedu.vn', [Role.STUDENT], '0908000006', 'Trần Thị Bình');

    superadminClient = sa.client;
    adminClient = admin.client;
    teacherClient = teacher.client;
    teacherId = teacher.id;
    otherTeacherClient = otherTeacher.client;
    otherTeacherId = otherTeacher.id;
    studentAClient = stuA.client;
    studentAId = stuA.id;
    studentBClient = stuB.client;
    studentBId = stuB.id;
  });

  async function createPublishedAssessmentAndAssign(params: {
    courseId: string;
    classId: string;
    title: string;
    type: AssessmentType;
    dueAt: Date;
    assignedAt?: Date;
    pointsPerQuestion?: number;
  }): Promise<{ assignmentId: string; questionIds: [string, string] }> {
    const points = params.pointsPerQuestion ?? 10;
    const asmRes = await teacherClient
      .post('/api/v1/assessments')
      .send({
        title: params.title,
        type: params.type,
        courseId: params.courseId,
        durationMinutes: params.type === AssessmentType.HOMEWORK ? null : 30,
      })
      .expect(201);
    const assessmentId = (asmRes.body as { id: string }).id;

    const q1Res = await teacherClient
      .post(`/api/v1/assessments/${assessmentId}/questions`)
      .send({
        type: 'SINGLE_CHOICE',
        prompt: `${params.title} — Câu 1`,
        points,
        payload: {
          options: [
            { id: 'a', text: 'Đúng' },
            { id: 'b', text: 'Sai' },
          ],
          correctOptionIds: ['a'],
        },
      })
      .expect(201);
    const q2Res = await teacherClient
      .post(`/api/v1/assessments/${assessmentId}/questions`)
      .send({
        type: 'SINGLE_CHOICE',
        prompt: `${params.title} — Câu 2`,
        points,
        payload: {
          options: [
            { id: 'a', text: 'Đúng' },
            { id: 'b', text: 'Sai' },
          ],
          correctOptionIds: ['a'],
        },
      })
      .expect(201);

    await teacherClient.post(`/api/v1/assessments/${assessmentId}/publish`).expect(201);

    const futureDue = new Date(Date.now() + 2 * 86_400_000);
    const assignRes = await teacherClient
      .post(`/api/v1/assessments/${assessmentId}/assign`)
      .send({
        classIds: [params.classId],
        dueAt: toVnOffsetIso(params.dueAt.getTime() > Date.now() ? params.dueAt : futureDue),
      })
      .expect(201);
    const assignmentId = (assignRes.body as { items: Array<{ id: string }> }).items[0]!.id;

    if (params.dueAt.getTime() <= Date.now() || params.assignedAt) {
      await harness.prisma.classAssignment.update({
        where: { id: assignmentId },
        data: {
          dueAt: params.dueAt,
          ...(params.assignedAt ? { assignedAt: params.assignedAt } : {}),
        },
      });
    }

    return {
      assignmentId,
      questionIds: [(q1Res.body as { id: string }).id, (q2Res.body as { id: string }).id],
    };
  }

  it('enforces dynamic course weights, Zero-Leak (GRADED vs RETURNED), 20->10 scaling, overdue-zero rules, enrollment isolation & RBAC on real PostgreSQL', async () => {
    // 1. Dynamic course weights validation & creation (30/0/70, passingScore 6.0)
    await adminClient
      .post('/api/v1/courses')
      .send({
        code: 'HSK-BAD',
        name: 'Bad Sum Course',
        level: CourseLevel.HSK1,
        miniTestWeight: 30,
        midtermWeight: 30,
        finalWeight: 50,
        passingScore: 5,
      })
      .expect(400);

    await adminClient
      .post('/api/v1/courses')
      .send({
        code: 'HSK-BAD2',
        name: 'Bad Passing Course',
        level: CourseLevel.HSK1,
        miniTestWeight: 20,
        midtermWeight: 30,
        finalWeight: 50,
        passingScore: 10.5,
      })
      .expect(400);

    const courseRes = await adminClient
      .post('/api/v1/courses')
      .send({
        code: 'HSK2-P8',
        name: 'Tiếng Trung HSK 2 Trọng số 30/0/70',
        level: CourseLevel.HSK2,
        defaultSessions: 12,
        miniTestWeight: 30,
        midtermWeight: 0,
        finalWeight: 70,
        passingScore: 6.0,
      })
      .expect(201);
    const courseId = (courseRes.body as { id: string }).id;
    expect(courseRes.body).toMatchObject({
      miniTestWeight: 30,
      midtermWeight: 0,
      finalWeight: 70,
      passingScore: 6,
    });

    // Partial unbalanced update rejected with 400
    await adminClient
      .patch(`/api/v1/courses/${courseId}`)
      .send({ finalWeight: 60 })
      .expect(400);

    // 2. Seed current class for Student A & Student B + historical old class for Student B
    const mainClass = await harness.prisma.class.create({
      data: {
        code: 'HSK2-P8-A',
        courseId,
        teacherId,
        status: ClassStatus.ACTIVE,
        startDate: new Date('2026-10-01T00:00:00.000Z'),
        totalSessions: 10,
        expectedEndDate: new Date('2026-12-15T00:00:00.000Z'),
      },
    });

    const oldClass = await harness.prisma.class.create({
      data: {
        code: 'HSK1-P8-OLD',
        courseId,
        teacherId: otherTeacherId,
        status: ClassStatus.COMPLETED,
        startDate: new Date('2026-01-10T00:00:00.000Z'),
        totalSessions: 10,
        actualEndDate: new Date('2026-05-01T00:00:00.000Z'),
      },
    });

    const todayVn = resolveVnToday(new Date());
    const enrolledBeforeOld = new Date(todayVn.getTime() - 10 * 86_400_000);
    const enrolledBDate = new Date(todayVn.getTime() - 2 * 86_400_000);

    await harness.prisma.enrollment.create({
      data: {
        classId: mainClass.id,
        studentId: studentAId,
        status: EnrollmentStatus.ACTIVE,
        enrolledDate: enrolledBeforeOld,
      },
    });
    await harness.prisma.enrollment.create({
      data: {
        classId: oldClass.id,
        studentId: studentBId,
        status: EnrollmentStatus.TRANSFERRED,
        enrolledDate: new Date('2026-01-10T00:00:00.000Z'),
        leftDate: new Date('2026-05-01T00:00:00.000Z'),
      },
    });
    await harness.prisma.enrollment.create({
      data: {
        classId: mainClass.id,
        studentId: studentBId,
        status: EnrollmentStatus.ACTIVE,
        enrolledDate: enrolledBDate,
      },
    });

    // Seed historical RETURNED 10/10 Final in oldClass for Student B -> must NOT leak into mainClass!
    const oldAsm = await harness.prisma.assessment.create({
      data: {
        title: 'Old Class Final',
        type: AssessmentType.FINAL,
        courseId,
        createdById: otherTeacherId,
        status: 'PUBLISHED',
        isLocked: true,
        questions: {
          create: {
            type: 'SINGLE_CHOICE',
            position: 1,
            prompt: 'Q1',
            points: 10,
            payload: { options: [{ id: 'a', text: 'A' }], correctOptionIds: ['a'] },
          },
        },
      },
    });
    const oldClassAssignment = await harness.prisma.classAssignment.create({
      data: {
        assessmentId: oldAsm.id,
        classId: oldClass.id,
        assignedById: otherTeacherId,
        assignedAt: new Date('2026-04-01T03:00:00.000Z'),
        dueAt: new Date('2026-04-05T10:00:00.000Z'),
      },
    });
    await harness.prisma.submission.create({
      data: {
        classAssignmentId: oldClassAssignment.id,
        studentId: studentBId,
        status: 'RETURNED',
        totalScore: 10,
        submittedAt: new Date('2026-04-02T03:00:00.000Z'),
        returnedAt: new Date('2026-04-03T03:00:00.000Z'),
      },
    });

    // 3. Create & submit MINI_TEST (20 pts max) + FINAL (20 pts max) in mainClass
    const mini1 = await createPublishedAssessmentAndAssign({
      courseId,
      classId: mainClass.id,
      title: 'Mini Test 1',
      type: AssessmentType.MINI_TEST,
      dueAt: new Date(Date.now() + 2 * 86_400_000),
      pointsPerQuestion: 10,
    });
    const final1 = await createPublishedAssessmentAndAssign({
      courseId,
      classId: mainClass.id,
      title: 'Final Exam',
      type: AssessmentType.FINAL,
      dueAt: new Date(Date.now() + 3 * 86_400_000),
      pointsPerQuestion: 10,
    });

    // Student A submits MINI_TEST (10/20 = 5.0) & FINAL (20/20 -> wait: 1 correct + 1 wrong? Let's score 16/20 by setting q1=16, q2=4 or 20/20 -> let's adjust or use 2 questions of 10? Wait: 16/20 needs 16 + 4 or 10 + 6! Let's verify 10+10 = 20, 1 correct = 10/20 = 5.0, or adjust to 16/20 via adjust-grade or question points! Even better: test FINAL with 20/20 = 10 or adjust to 16/20!).
    const startMini = await studentAClient
      .post(`/api/v1/assignments/${mini1.assignmentId}/submissions/start`)
      .expect(200);
    const subMiniAId = (startMini.body as { submission: { id: string } }).submission.id;
    await studentAClient
      .post(`/api/v1/assignments/${mini1.assignmentId}/submissions/submit`)
      .send({
        elapsedSeconds: 30,
        answers: [
          { questionId: mini1.questionIds[0], answerPayload: { selectedOptionIds: ['a'] } }, // +10
          { questionId: mini1.questionIds[1], answerPayload: { selectedOptionIds: ['b'] } }, // +0 -> 10/20
        ],
      })
      .expect(200);

    const startFin = await studentAClient
      .post(`/api/v1/assignments/${final1.assignmentId}/submissions/start`)
      .expect(200);
    const subFinAId = (startFin.body as { submission: { id: string } }).submission.id;
    await studentAClient
      .post(`/api/v1/assignments/${final1.assignmentId}/submissions/submit`)
      .send({
        elapsedSeconds: 45,
        answers: [
          { questionId: final1.questionIds[0], answerPayload: { selectedOptionIds: ['a'] } }, // +10
          { questionId: final1.questionIds[1], answerPayload: { selectedOptionIds: ['a'] } }, // +10
        ],
      })
      .expect(200);

    // Grade both; adjust Final to 16/20 (8.0 on scale 10); confirm BOTH -> GRADED; publish ONLY Final -> RETURNED!
    await teacherClient.post(`/api/v1/submissions/${subMiniAId}/auto-grade`).expect(200);
    await teacherClient.post(`/api/v1/submissions/${subMiniAId}/confirm-grade`).expect(200);

    await teacherClient.post(`/api/v1/submissions/${subFinAId}/auto-grade`).expect(200);
    await teacherClient.post(`/api/v1/submissions/${subFinAId}/confirm-grade`).expect(200);
    await teacherClient
      .patch(`/api/v1/submissions/${subFinAId}/adjust-grade`)
      .send({
        reason: 'Chuẩn hóa đề thi 16/20',
        answers: [{ questionId: final1.questionIds[1], earnedPoints: 6 }],
      })
      .expect(200);
    await teacherClient
      .post(`/api/v1/assignments/${final1.assignmentId}/publish-grades`)
      .send({})
      .expect(200);

    // ZERO-LEAK CHECK: Mini Test is GRADED (NOT RETURNED) -> must NOT appear anywhere in /progress/me or /classes/:id/progress!
    const studentAPrePub = await studentAClient.get('/api/v1/progress/me').expect(200);
    expect(studentAPrePub.body.academicSummary).toMatchObject({
      miniTestAvg: null,
      miniTestCount: 0,
      midtermAvg: null,
      midtermCount: 0,
      finalAvg: 8,
      finalCount: 1,
      finalScore: null,
      passStatus: 'INSUFFICIENT_DATA',
    });
    expect(studentAPrePub.body.publishedResults).toHaveLength(1);
    expect(studentAPrePub.body.publishedResults[0]).toMatchObject({
      assignmentId: final1.assignmentId,
      rawScore: 16,
      maxScore: 20,
      score10: 8,
    });

    const teacherPrePub = await teacherClient
      .get(`/api/v1/classes/${mainClass.id}/progress`)
      .expect(200);
    const teacherStuA = (
      teacherPrePub.body as {
        students: Array<{
          studentId: string;
          miniTestAvg: number | null;
          finalAvg: number | null;
          finalScore: number | null;
          passStatus: string;
        }>;
      }
    ).students.find((s) => s.studentId === studentAId)!;
    expect(teacherStuA).toMatchObject({
      miniTestAvg: null,
      finalAvg: 8,
      finalScore: null,
      passStatus: 'INSUFFICIENT_DATA',
    });

    // 4. Publish Mini Test (10/20 = 5.0) -> dynamic formula 30/0/70 (midtermWeight=0 omitted!) -> (5.0*30 + 8.0*70)/100 = 7.1 >= 6.0 -> PASSED!
    await teacherClient
      .post(`/api/v1/assignments/${mini1.assignmentId}/publish-grades`)
      .send({})
      .expect(200);

    const studentAPub = await studentAClient.get('/api/v1/progress/me').expect(200);
    expect(studentAPub.body.academicSummary).toMatchObject({
      miniTestAvg: 5,
      miniTestCount: 1,
      midtermAvg: null,
      midtermCount: 0,
      finalAvg: 8,
      finalCount: 1,
      finalScore: 7.1,
      passStatus: 'PASSED',
    });
    expect(studentAPub.body.publishedResults).toHaveLength(2);

    // Raise course passingScore to 7.5 -> immediately becomes FAILED
    await adminClient
      .patch(`/api/v1/courses/${courseId}`)
      .send({ passingScore: 7.5 })
      .expect(200);
    const studentAFailed = await studentAClient.get('/api/v1/progress/me').expect(200);
    expect(studentAFailed.body.academicSummary).toMatchObject({
      finalScore: 7.1,
      passStatus: 'FAILED',
    });

    // 5. Overdue-zero & Homework vs Exam rules + Enrollment Interval isolation for Student B
    // Assign HW1 BEFORE Student B enrolled (Student A eligible, Student B NOT eligible)
    const hwBeforeB = await createPublishedAssessmentAndAssign({
      courseId,
      classId: mainClass.id,
      title: 'BTVN Trước Khi Bình Nhập Học',
      type: AssessmentType.HOMEWORK,
      assignedAt: new Date(todayVn.getTime() - 6 * 86_400_000),
      dueAt: new Date(todayVn.getTime() - 4 * 86_400_000),
      pointsPerQuestion: 5,
    });
    // Assign HW2 AFTER Student B enrolled (eligible for both A & B, overdue)
    const hwCurrent = await createPublishedAssessmentAndAssign({
      courseId,
      classId: mainClass.id,
      title: 'BTVN Hiện Tại',
      type: AssessmentType.HOMEWORK,
      assignedAt: new Date(todayVn.getTime() - 1 * 86_400_000),
      dueAt: new Date(Date.now() - 3_600_000),
      pointsPerQuestion: 5,
    });
    // Assign Mini Test 2 (overdue) -> record overdue-zero + publish for Student A -> drops miniTestAvg from 5.0 to 2.5
    const miniOverdue = await createPublishedAssessmentAndAssign({
      courseId,
      classId: mainClass.id,
      title: 'Mini Test 2 Quá Hạn',
      type: AssessmentType.MINI_TEST,
      assignedAt: new Date(todayVn.getTime() - 1 * 86_400_000),
      dueAt: new Date(Date.now() - 3_600_000),
      pointsPerQuestion: 5,
    });

    // Student A starts & submits HW1 before moving dueAt? Move dueAt forward briefly or start+submit? Since dueAt is already past, let's adjust dueAt to future, submit, then back to past!
    await harness.prisma.classAssignment.update({
      where: { id: hwBeforeB.assignmentId },
      data: { dueAt: new Date(Date.now() + 3_600_000) },
    });
    await studentAClient
      .post(`/api/v1/assignments/${hwBeforeB.assignmentId}/submissions/start`)
      .expect(200);
    await studentAClient
      .post(`/api/v1/assignments/${hwBeforeB.assignmentId}/submissions/submit`)
      .send({
        elapsedSeconds: 20,
        answers: [{ questionId: hwBeforeB.questionIds[0], answerPayload: { selectedOptionIds: ['a'] } }],
      })
      .expect(200);
    await harness.prisma.classAssignment.update({
      where: { id: hwBeforeB.assignmentId },
      data: { dueAt: new Date(todayVn.getTime() - 4 * 86_400_000) },
    });

    // Overdue-zero & publish on hwCurrent & miniOverdue for Student A
    await teacherClient
      .post(`/api/v1/assignments/${hwCurrent.assignmentId}/overdue-zero`)
      .send({ studentIds: [studentAId], reason: 'Quá hạn chưa nộp BTVN' })
      .expect(200);
    await teacherClient
      .post(`/api/v1/assignments/${hwCurrent.assignmentId}/publish-grades`)
      .send({})
      .expect(200);

    await teacherClient
      .post(`/api/v1/assignments/${miniOverdue.assignmentId}/overdue-zero`)
      .send({ studentIds: [studentAId], reason: 'Quá hạn Mini Test 2' })
      .expect(200);
    await teacherClient
      .post(`/api/v1/assignments/${miniOverdue.assignmentId}/publish-grades`)
      .send({})
      .expect(200);

    const afterOverdueRes = await studentAClient.get('/api/v1/progress/me').expect(200);
    // HW1 submitted (SUBMITTED_WAITING), HW2 overdue-zero RETURNED -> submittedCount=1, givenCount=2, rate=50%, averageScore10=0!
    expect(afterOverdueRes.body.academicSummary.homeworkStats).toEqual({
      submittedCount: 1,
      givenCount: 2,
      submissionRatePercent: 50,
      averageScore10: 0,
    });
    // Mini Test: 5.0 and 0.0 -> 2.5; Final: 8.0; (2.5*30 + 8.0*70)/100 = 6.35 -> 6.4!
    expect(afterOverdueRes.body.academicSummary.miniTestCount).toBe(2);
    expect(afterOverdueRes.body.academicSummary.miniTestAvg).toBe(2.5);
    expect(afterOverdueRes.body.academicSummary.finalScore).toBe(6.4);

    // Check Student B isolation:
    // - Teacher of mainClass sees Student B with homeworkGivenCount === 1 (hwBeforeB excluded!), finalAvg === null (oldClass 10/10 NOT leaked!), isAtRisk === true (0/1 = 0% < 60%)
    const classReport = await teacherClient
      .get(`/api/v1/classes/${mainClass.id}/progress`)
      .expect(200);
    expect(JSON.stringify(classReport.body)).not.toContain('HSK1-P8-OLD');
    const teacherStuB = (
      classReport.body as {
        students: Array<{
          studentId: string;
          homeworkGivenCount: number;
          homeworkSubmittedCount: number;
          finalAvg: number | null;
          isAtRisk: boolean;
        }>;
      }
    ).students.find((s) => s.studentId === studentBId)!;
    expect(teacherStuB).toMatchObject({
      homeworkGivenCount: 1,
      homeworkSubmittedCount: 0,
      finalAvg: null,
      isAtRisk: true,
    });

    // Student B's own /progress/me defaults to ACTIVE mainClass and preserves classHistory (including oldClass)
    const stuBDefault = await studentBClient.get('/api/v1/progress/me').expect(200);
    expect(stuBDefault.body.selectedClass.classId).toBe(mainClass.id);
    expect(stuBDefault.body.classHistory).toHaveLength(2);

    // Student B can view their own oldClass via ?classId=oldClass.id
    const stuBOld = await studentBClient
      .get(`/api/v1/progress/me?classId=${oldClass.id}`)
      .expect(200);
    expect(stuBOld.body.selectedClass.classId).toBe(oldClass.id);
    expect(stuBOld.body.academicSummary.finalAvg).toBe(10);

    // 6. IDOR & RBAC guards
    // Student A is NOT enrolled in oldClass -> 403
    await studentAClient.get(`/api/v1/progress/me?classId=${oldClass.id}`).expect(403);
    // Unassigned teacher cannot view mainClass progress -> 403
    await otherTeacherClient.get(`/api/v1/classes/${mainClass.id}/progress`).expect(403);
    // Pure SUPERADMIN gets 403 on all 3 endpoints
    await superadminClient.get('/api/v1/progress/me').expect(403);
    await superadminClient.get(`/api/v1/classes/${mainClass.id}/progress`).expect(403);
    await superadminClient.get('/api/v1/progress/admin-overview').expect(403);
    // Student cannot call class progress or admin overview; Teacher cannot call /progress/me or admin overview
    await studentAClient.get(`/api/v1/classes/${mainClass.id}/progress`).expect(403);
    await studentAClient.get('/api/v1/progress/admin-overview').expect(403);
    await teacherClient.get('/api/v1/progress/me').expect(403);
    await teacherClient.get('/api/v1/progress/admin-overview').expect(403);
  });

  it('GET /api/v1/progress/admin-overview computes KPIs, batched averageAttendanceRatePercent, today/5-day sessions & filters', async () => {
    const course1 = await harness.prisma.course.create({
      data: { code: 'HSK1-OV', name: 'HSK 1 Overview', level: CourseLevel.HSK1 },
    });
    const course2 = await harness.prisma.course.create({
      data: { code: 'HSK2-OV', name: 'HSK 2 Overview', level: CourseLevel.HSK2 },
    });

    const todayVn = resolveVnToday(new Date());
    const yesterdayVn = new Date(todayVn.getTime() - 86_400_000);
    const plus3DaysVn = new Date(todayVn.getTime() + 3 * 86_400_000);
    const plus8DaysVn = new Date(todayVn.getTime() + 8 * 86_400_000);

    const activeCls = await harness.prisma.class.create({
      data: {
        code: 'OV-ACT-01',
        courseId: course1.id,
        teacherId,
        status: ClassStatus.ACTIVE,
        startDate: yesterdayVn,
        totalSessions: 10,
      },
    });
    const upcomingCls = await harness.prisma.class.create({
      data: {
        code: 'OV-UPC-02',
        courseId: course2.id,
        teacherId: otherTeacherId,
        status: ClassStatus.UPCOMING,
        startDate: plus3DaysVn,
        totalSessions: 12,
      },
    });
    const completedCls = await harness.prisma.class.create({
      data: {
        code: 'OV-DONE-03',
        courseId: course1.id,
        teacherId,
        status: ClassStatus.COMPLETED,
        startDate: new Date('2026-01-01T00:00:00.000Z'),
        actualEndDate: new Date('2026-04-01T00:00:00.000Z'),
        totalSessions: 8,
      },
    });

    // Pending student KPI
    await seedAndLoginUser(
      'pending.p8@webedu.vn',
      [Role.STUDENT],
      '0908000099',
      'Học Viên Chờ',
      UserStatus.PENDING_CLASS,
    );

    // Enroll Student A & Student B in activeCls
    await harness.prisma.enrollment.createMany({
      data: [
        {
          classId: activeCls.id,
          studentId: studentAId,
          status: EnrollmentStatus.ACTIVE,
          enrolledDate: yesterdayVn,
        },
        {
          classId: activeCls.id,
          studentId: studentBId,
          status: EnrollmentStatus.ACTIVE,
          enrolledDate: yesterdayVn,
        },
      ],
    });

    // Sessions for activeCls: 1 COMPLETED yesterday, 1 SCHEDULED today, 1 CANCELLED today (ignored), 1 SCHEDULED +3 days, 1 SCHEDULED +8 days (outside 5-day window!)
    const doneSession = await harness.prisma.lessonSession.create({
      data: {
        classId: activeCls.id,
        sessionNumber: 1,
        sessionDate: yesterdayVn,
        startTime: '18:00',
        endTime: '19:30',
        status: SessionStatus.COMPLETED,
      },
    });
    await harness.prisma.lessonSession.createMany({
      data: [
        {
          classId: activeCls.id,
          sessionNumber: 2,
          sessionDate: todayVn,
          startTime: '18:00',
          endTime: '19:30',
          status: SessionStatus.SCHEDULED,
        },
        {
          classId: activeCls.id,
          sessionNumber: null,
          sessionDate: todayVn,
          startTime: '20:00',
          endTime: '21:30',
          status: SessionStatus.CANCELLED,
        },
        {
          classId: activeCls.id,
          sessionNumber: 3,
          type: SessionType.MAKEUP,
          sessionDate: plus3DaysVn,
          startTime: '18:00',
          endTime: '19:30',
          status: SessionStatus.SCHEDULED,
          isMakeup: true,
        },
        {
          classId: upcomingCls.id,
          sessionNumber: 1,
          sessionDate: plus8DaysVn,
          startTime: '19:00',
          endTime: '20:30',
          status: SessionStatus.SCHEDULED,
        },
      ],
    });

    // Attendance on doneSession: 1 PRESENT, 1 ABSENT -> 50%
    await harness.prisma.attendanceRecord.createMany({
      data: [
        {
          sessionId: doneSession.id,
          classId: activeCls.id,
          studentId: studentAId,
          status: AttendanceStatus.PRESENT,
          markedById: teacherId,
        },
        {
          sessionId: doneSession.id,
          classId: activeCls.id,
          studentId: studentBId,
          status: AttendanceStatus.ABSENT,
          markedById: teacherId,
        },
      ],
    });

    // Default overview excludes COMPLETED class
    const overviewRes = await adminClient.get('/api/v1/progress/admin-overview').expect(200);
    expect(overviewRes.body.kpis).toEqual({
      activeClassesCount: 1,
      upcomingClassesCount: 1,
      activeStudentsCount: 2,
      pendingEnrollmentCount: 1,
      todaySessionsCount: 1,
    });
    expect(overviewRes.body.classes).toHaveLength(2);

    const activeRow = (
      overviewRes.body.classes as Array<{
        classId: string;
        enrolledCount: number;
        completedSessionsCount: number;
        remainingSessionsCount: number;
        progressPercent: number;
        averageAttendanceRatePercent: number | null;
        nextSession: { sessionNumber: number | null } | null;
      }>
    ).find((c) => c.classId === activeCls.id)!;
    expect(activeRow).toMatchObject({
      enrolledCount: 2,
      completedSessionsCount: 1,
      remainingSessionsCount: 9,
      progressPercent: 10,
      averageAttendanceRatePercent: 50,
    });
    expect(activeRow.nextSession?.sessionNumber).toBe(2);

    const upcomingRow = (
      overviewRes.body.classes as Array<{
        classId: string;
        averageAttendanceRatePercent: number | null;
      }>
    ).find((c) => c.classId === upcomingCls.id)!;
    expect(upcomingRow.averageAttendanceRatePercent).toBeNull();

    // Today & next-5-days sessions (CANCELLED today & +8 days excluded)
    expect(overviewRes.body.todaySessions).toHaveLength(1);
    expect(overviewRes.body.todaySessions[0].classCode).toBe('OV-ACT-01');
    expect(overviewRes.body.upcomingSessions).toHaveLength(1);
    expect(overviewRes.body.upcomingSessions[0]).toMatchObject({
      classCode: 'OV-ACT-01',
      isMakeup: true,
    });

    // Filtering by courseId, teacherId, status, includeEnded
    const filteredRes = await adminClient
      .get(`/api/v1/progress/admin-overview?courseId=${course1.id}&teacherId=${teacherId}&includeEnded=true`)
      .expect(200);
    expect(filteredRes.body.classes.map((c: { classId: string }) => c.classId)).toEqual([
      activeCls.id,
      completedCls.id,
    ]);

    const completedOnlyRes = await adminClient
      .get(`/api/v1/progress/admin-overview?status=${ClassStatus.COMPLETED}`)
      .expect(200);
    expect(completedOnlyRes.body.classes.map((c: { classId: string }) => c.classId)).toEqual([
      completedCls.id,
    ]);
  });
});
