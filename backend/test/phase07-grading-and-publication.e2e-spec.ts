import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import {
  AssessmentType,
  ClassStatus,
  CourseLevel,
  EnrollmentStatus,
  GradingStatus,
  Role,
  SubmissionStatus,
  UserStatus,
} from '@prisma/client';
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

describe('Phase 7 Grading, AI Essay Draft, 2-Step Confirm/Publish & Zero-Leak E2E (Real PostgreSQL)', () => {
  let harness: RealE2eAppHarness;
  let server: Server;
  let passwordHash: string;

  let courseId: string;
  let classId: string;
  let studentAId: string;
  let studentBId: string;

  let superadminClient: Client;
  let adminClient: Client;
  let teacherClient: Client;
  let otherTeacherClient: Client;
  let studentAClient: Client;
  let studentBClient: Client;

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
  ): Promise<{ id: string; client: Client }> {
    const user = await harness.prisma.user.create({
      data: { email, phone, fullName, passwordHash, roles, status: UserStatus.ACTIVE },
    });
    const loginRes = await request(server)
      .post('/api/v1/auth/login')
      .send({ email, password: PASSWORD })
      .expect(200);
    return { id: user.id, client: makeClient(server, extractAuthCookie(loginRes).cookiePair) };
  }

  beforeEach(async () => {
    await harness.resetState();

    const course = await harness.prisma.course.create({
      data: { code: 'HSK1-P7', name: 'Tiếng Trung HSK 1', level: CourseLevel.HSK1 },
    });
    courseId = course.id;

    const sa = await seedAndLoginUser('sa.p7@webedu.vn', [Role.SUPERADMIN], '0907000001', 'Super Admin');
    const admin = await seedAndLoginUser('admin.p7@webedu.vn', [Role.ADMIN], '0907000002', 'Học Vụ');
    const teacher = await seedAndLoginUser('gv.p7@webedu.vn', [Role.TEACHER], '0907000003', 'Cô Lan');
    const otherTeacher = await seedAndLoginUser('gv.other.p7@webedu.vn', [Role.TEACHER], '0907000004', 'Thầy Minh');
    const stuA = await seedAndLoginUser('hv.a.p7@webedu.vn', [Role.STUDENT], '0907000005', 'Nguyễn An');
    const stuB = await seedAndLoginUser('hv.b.p7@webedu.vn', [Role.STUDENT], '0907000006', 'Trần Bình');

    superadminClient = sa.client;
    adminClient = admin.client;
    teacherClient = teacher.client;
    otherTeacherClient = otherTeacher.client;
    studentAId = stuA.id;
    studentAClient = stuA.client;
    studentBId = stuB.id;
    studentBClient = stuB.client;

    const cls = await harness.prisma.class.create({
      data: {
        code: 'HSK1-K26-P7',
        courseId,
        teacherId: teacher.id,
        status: ClassStatus.ACTIVE,
        startDate: new Date('2026-10-01T00:00:00.000Z'),
      },
    });
    classId = cls.id;

    for (const sid of [studentAId, studentBId]) {
      await harness.prisma.enrollment.create({
        data: {
          classId,
          studentId: sid,
          status: EnrollmentStatus.ACTIVE,
          enrolledDate: new Date('2026-10-01T00:00:00.000Z'),
        },
      });
    }
  });

  async function createAndAssignMixedAssessment(): Promise<{
    assignmentId: string;
    questionIds: { single: string; multi: string; fill: string; ordering: string; essay: string };
  }> {
    const asmRes = await teacherClient
      .post('/api/v1/assessments')
      .send({
        title: 'Kiểm tra HSK 1 Tổng hợp',
        type: AssessmentType.MINI_TEST,
        courseId,
        durationMinutes: 30,
      })
      .expect(201);
    const assessmentId = (asmRes.body as { id: string }).id;

    const addQ = async (body: Record<string, unknown>) => {
      const res = await teacherClient.post(`/api/v1/assessments/${assessmentId}/questions`).send(body).expect(201);
      return (res.body as { id: string }).id;
    };

    const single = await addQ({
      type: 'SINGLE_CHOICE',
      prompt: 'Chọn nghĩa 你好',
      points: 2,
      payload: {
        options: [
          { id: 'a', text: 'Xin chào' },
          { id: 'b', text: 'Tạm biệt' },
        ],
        correctOptionIds: ['a'],
        explanation: '你好 nghĩa là Xin chào',
      },
    });
    const multi = await addQ({
      type: 'MULTIPLE_CHOICE',
      prompt: 'Chọn 2 danh từ',
      points: 2,
      payload: {
        options: [
          { id: 'a', text: '书' },
          { id: 'b', text: '人' },
          { id: 'c', text: '跑' },
        ],
        correctOptionIds: ['a', 'b'],
      },
    });
    const fill = await addQ({
      type: 'FILL_BLANK',
      prompt: '我___学生',
      points: 1,
      payload: {
        acceptedAnswers: ['是'],
        caseSensitive: false,
        pinyinSensitive: false,
      },
    });
    const ordering = await addQ({
      type: 'ORDERING',
      prompt: 'Sắp xếp câu',
      points: 1,
      payload: {
        tokens: ['我', '是', '学生'],
        correctSentence: '我是学生',
      },
    });
    const essay = await addQ({
      type: 'ESSAY',
      prompt: 'Viết giới thiệu ngắn',
      points: 4,
      payload: {
        sampleAnswer: '我叫安，我是学生。',
        rubric: 'Đúng ngữ pháp HSK 1',
      },
    });

    await teacherClient.post(`/api/v1/assessments/${assessmentId}/publish`).expect(201);
    const dueAt = new Date(Date.now() + 2 * 86_400_000);
    const assignRes = await teacherClient
      .post(`/api/v1/assessments/${assessmentId}/assign`)
      .send({ classIds: [classId], dueAt: toVnOffsetIso(dueAt) })
      .expect(201);
    const assignmentId = (assignRes.body as { items: Array<{ id: string }> }).items[0]!.id;

    return { assignmentId, questionIds: { single, multi, fill, ordering, essay } };
  }

  it('enforces full Phase 7 lifecycle: auto-grade, AI config isolation, manual grade, 2-step confirm -> publish, Zero-Leak, overdue-zero & GradeAuditLog', async () => {
    const { assignmentId, questionIds } = await createAndAssignMixedAssessment();

    // 1. SUPERADMIN sets dynamic AI config & public /system-settings/config leaks ZERO AI config
    await superadminClient
      .put('/api/v1/system-settings/ai-grading')
      .send({
        enabled: true,
        provider: 'OPENAI',
        model: 'gpt-4o-mini',
        apiKey: 'sk-super-secret-e2e-123456',
      })
      .expect(200);

    const aiCfgRes = await superadminClient.get('/api/v1/system-settings/ai-grading').expect(200);
    expect((aiCfgRes.body as { hasApiKey: boolean; maskedApiKey: string }).hasApiKey).toBe(true);
    expect((aiCfgRes.body as { maskedApiKey: string }).maskedApiKey).toContain('••••');
    expect(JSON.stringify(aiCfgRes.body)).not.toContain('sk-super-secret-e2e-123456');

    const publicCfgRes = await request(server).get('/api/v1/system-settings/config').expect(200);
    expect(JSON.stringify(publicCfgRes.body)).not.toContain('OPENAI');
    expect(JSON.stringify(publicCfgRes.body)).not.toContain('gpt-4o-mini');
    expect(JSON.stringify(publicCfgRes.body)).not.toContain('sk-super-secret');

    await teacherClient.get('/api/v1/system-settings/ai-grading').expect(403);
    await adminClient.get('/api/v1/system-settings/ai-grading').expect(403);

    // 2. Student A starts & submits mixed test (full auto score = 2+1+1+1 = 5 with partial credit: single=2, multi only 1 of 2 correct = 1, fill=1 with trailing '。', ordering=1)
    const startRes = await studentAClient
      .post(`/api/v1/assignments/${assignmentId}/submissions/start`)
      .expect(200);
    const submissionAId = (startRes.body as { submission: { id: string } }).submission.id;

    await studentAClient
      .post(`/api/v1/assignments/${assignmentId}/submissions/submit`)
      .send({
        elapsedSeconds: 120,
        answers: [
          { questionId: questionIds.single, answerPayload: { selectedOptionIds: ['a'] } },
          { questionId: questionIds.multi, answerPayload: { selectedOptionIds: ['a'] } },
          { questionId: questionIds.fill, answerPayload: { text: ' 是。 ' } },
          { questionId: questionIds.ordering, answerPayload: { orderedTokens: ['我', '是', '学生'] } },
          { questionId: questionIds.essay, answerPayload: { text: '我叫安，很高兴认识你。' } },
        ],
      })
      .expect(200);

    // 3. Zero-Leak immediately after submit (SUBMITTED_WAITING)
    const preGradePublishedRes = await studentAClient
      .get(`/api/v1/assignments/${assignmentId}/published-result`)
      .expect(200);
    expect((preGradePublishedRes.body as { isPublished: boolean; result: null }).isPublished).toBe(false);
    expect((preGradePublishedRes.body as { result: null }).result).toBeNull();

    const myAssignmentsPre = await studentAClient.get('/api/v1/assignments/me').expect(200);
    const myItemPre = (myAssignmentsPre.body as { items: Array<{ autoScore: number | null; totalScore: number | null }> }).items[0]!;
    expect(myItemPre.autoScore).toBeNull();
    expect(myItemPre.totalScore).toBeNull();

    // 4. Other/unassigned teacher gets 403 across tracker & grading actions
    await otherTeacherClient.get(`/api/v1/assignments/${assignmentId}/grading-tracker`).expect(403);
    await otherTeacherClient.get(`/api/v1/submissions/${submissionAId}/grading-detail`).expect(403);

    // 5. Teacher views grading tracker & submission detail; sees autoScore=5 & ungraded essay
    const trackerRes = await teacherClient
      .get(`/api/v1/assignments/${assignmentId}/grading-tracker`)
      .expect(200);
    const tracker = trackerRes.body as {
      summary: { totalStudents: number; submittedWaitingCount: number; notStartedCount: number };
      students: Array<{ studentId: string; autoScore: number | null; ungradedSubjectiveCount: number; canConfirm: boolean }>;
    };
    expect(tracker.summary).toMatchObject({ totalStudents: 2, submittedWaitingCount: 1, notStartedCount: 1 });
    const stuARow = tracker.students.find((s) => s.studentId === studentAId)!;
    expect(stuARow.autoScore).toBe(5);
    expect(stuARow.ungradedSubjectiveCount).toBe(1);
    expect(stuARow.canConfirm).toBe(false);

    // Seed AI draft suggestion on Student A's essay to test applyAiSuggestion + non-leak
    await harness.prisma.submissionAnswer.update({
      where: { submissionId_questionId: { submissionId: submissionAId, questionId: questionIds.essay } },
      data: { aiSuggestedPoints: 3.5, aiFeedback: 'AI gợi ý nháp bí mật' },
    });
    await harness.prisma.submission.update({
      where: { id: submissionAId },
      data: { gradingStatus: GradingStatus.AI_DRAFT_READY },
    });

    // Reject confirm before essay graded & reject non-0.25 step
    await teacherClient.post(`/api/v1/submissions/${submissionAId}/confirm-grade`).expect(400);
    await teacherClient
      .patch(`/api/v1/submissions/${submissionAId}/manual-grade`)
      .send({ answers: [{ questionId: questionIds.essay, earnedPoints: 3.1 }] })
      .expect(400);

    // Teacher applies AI suggestion (3.5) and adds feedback
    const manualRes = await teacherClient
      .patch(`/api/v1/submissions/${submissionAId}/manual-grade`)
      .send({
        teacherFeedback: 'Bài làm tốt, ngữ pháp chuẩn.',
        answers: [{ questionId: questionIds.essay, applyAiSuggestion: true, teacherComment: 'Chữ đẹp' }],
      })
      .expect(200);
    expect((manualRes.body as { totalScore: number; readyToConfirm: boolean }).totalScore).toBe(8.5);
    expect((manualRes.body as { readyToConfirm: boolean }).readyToConfirm).toBe(true);

    // 6. Publish BEFORE Confirm -> 400
    await teacherClient.post(`/api/v1/assignments/${assignmentId}/publish-grades`).send({}).expect(400);

    // Step 1 Confirm -> GRADED
    const confirmRes = await teacherClient
      .post(`/api/v1/submissions/${submissionAId}/confirm-grade`)
      .expect(200);
    expect((confirmRes.body as { status: string; totalScore: number }).status).toBe(SubmissionStatus.GRADED);
    expect((confirmRes.body as { totalScore: number }).totalScore).toBe(8.5);

    // CRITICAL ZERO-LEAK CHECK: While status === GRADED (confirmed but NOT published), Student A MUST NOT see any score!
    const confirmedButUnpublishedRes = await studentAClient
      .get(`/api/v1/assignments/${assignmentId}/published-result`)
      .expect(200);
    expect((confirmedButUnpublishedRes.body as { isPublished: boolean; result: null }).isPublished).toBe(false);
    expect((confirmedButUnpublishedRes.body as { result: null }).result).toBeNull();

    const myAssignmentsConfirmed = await studentAClient.get('/api/v1/assignments/me').expect(200);
    const myItemConfirmed = (myAssignmentsConfirmed.body as { items: Array<{ status: string; autoScore: number | null; totalScore: number | null }> }).items[0]!;
    expect(myItemConfirmed.status).toBe(SubmissionStatus.GRADED);
    expect(myItemConfirmed.autoScore).toBeNull();
    expect(myItemConfirmed.totalScore).toBeNull();

    // 7. Move dueAt to past -> Student B is OVERDUE_NOT_SUBMITTED -> Step 2 Publish MUST NOT auto-zero Student B
    await harness.prisma.classAssignment.update({
      where: { id: assignmentId },
      data: { dueAt: new Date(Date.now() - 86_400_000) },
    });

    const publishRes = await teacherClient
      .post(`/api/v1/assignments/${assignmentId}/publish-grades`)
      .send({})
      .expect(200);
    expect((publishRes.body as { publishedCount: number; overdueUntouchedCount: number })).toMatchObject({
      publishedCount: 1,
      overdueUntouchedCount: 1,
    });

    // Student B still has NOT_STARTED & overdue filter catches Student B
    const overdueTrackerRes = await teacherClient
      .get(`/api/v1/assignments/${assignmentId}/grading-tracker?status=OVERDUE_NOT_SUBMITTED`)
      .expect(200);
    expect((overdueTrackerRes.body as { students: Array<{ studentId: string }> }).students.map((s) => s.studentId)).toEqual([
      studentBId,
    ]);

    // Student A can now see published result, objective answer keys, NEVER AI draft fields!
    const publishedRes = await studentAClient
      .get(`/api/v1/assignments/${assignmentId}/published-result`)
      .expect(200);
    const pubJson = JSON.stringify(publishedRes.body);
    expect((publishedRes.body as { isPublished: boolean }).isPublished).toBe(true);
    expect((publishedRes.body as { result: { totalScore: number; gradeUpdatedAt: string | null } }).result.totalScore).toBe(8.5);
    expect((publishedRes.body as { result: { gradeUpdatedAt: string | null } }).result.gradeUpdatedAt).toBeNull();
    expect(pubJson).toContain('你好 nghĩa là Xin chào');
    expect(pubJson).not.toContain('aiSuggestedPoints');
    expect(pubJson).not.toContain('aiFeedback');
    expect(pubJson).not.toContain('AI gợi ý nháp bí mật');
    expect(pubJson).not.toContain('Đúng ngữ pháp HSK 1');

    // 8. Post-Publish Adjustment + Mandatory Reason + GradeAuditLog + gradeUpdatedAt
    await teacherClient
      .patch(`/api/v1/submissions/${submissionAId}/adjust-grade`)
      .send({ reason: '   ', answers: [{ questionId: questionIds.essay, earnedPoints: 4 }] })
      .expect(400);

    const adjustRes = await adminClient
      .patch(`/api/v1/submissions/${submissionAId}/adjust-grade`)
      .send({
        reason: 'Admin phúc khảo cộng 0.5đ phần diễn đạt',
        answers: [{ questionId: questionIds.essay, earnedPoints: 4, teacherComment: 'Đã phúc khảo' }],
      })
      .expect(200);
    expect((adjustRes.body as { previousTotalScore: number; totalScore: number; gradeUpdatedAt: string | null })).toMatchObject({
      previousTotalScore: 8.5,
      totalScore: 9,
    });
    expect((adjustRes.body as { gradeUpdatedAt: string | null }).gradeUpdatedAt).not.toBeNull();

    // Student sees updated score & gradeUpdatedAt
    const updatedPubRes = await studentAClient
      .get(`/api/v1/assignments/${assignmentId}/published-result`)
      .expect(200);
    expect((updatedPubRes.body as { result: { totalScore: number; gradeUpdatedAt: string | null } }).result.totalScore).toBe(9);
    expect((updatedPubRes.body as { result: { gradeUpdatedAt: string | null } }).result.gradeUpdatedAt).not.toBeNull();

    // Teacher sees GradeAuditLog in submission detail
    const detailRes = await teacherClient
      .get(`/api/v1/submissions/${submissionAId}/grading-detail`)
      .expect(200);
    const logs = (detailRes.body as { auditLogs: Array<{ oldScore: number; newScore: number; reason: string }> }).auditLogs;
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({
      oldScore: 3.5,
      newScore: 4,
      reason: 'Admin phúc khảo cộng 0.5đ phần diễn đạt',
    });

    // 9. Explicit overdue-zero action records 0 points for Student B -> publish reveals 0 points
    const zeroRes = await teacherClient
      .post(`/api/v1/assignments/${assignmentId}/overdue-zero`)
      .send({ studentIds: [studentBId], reason: 'Không nộp bài sau hạn' })
      .expect(200);
    expect((zeroRes.body as { recordedCount: number }).recordedCount).toBe(1);

    await teacherClient.post(`/api/v1/assignments/${assignmentId}/publish-grades`).send({}).expect(200);
    const studentBResult = await studentBClient
      .get(`/api/v1/assignments/${assignmentId}/published-result`)
      .expect(200);
    expect((studentBResult.body as { isPublished: boolean; result: { totalScore: number } }).isPublished).toBe(true);
    expect((studentBResult.body as { result: { totalScore: number } }).result.totalScore).toBe(0);
  });
});
