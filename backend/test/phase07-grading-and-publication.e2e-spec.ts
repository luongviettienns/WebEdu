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
      prompt: 'Viết 1 câu tiếng Trung nói về sở thích đọc sách',
      points: 4,
      payload: {
        sampleAnswer: '我喜欢看书。',
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
        model: 'gpt-6-luna',
        apiKey: 'sk-super-secret-e2e-123456',
      })
      .expect(200);

    const aiCfgRes = await superadminClient.get('/api/v1/system-settings/ai-grading').expect(200);
    expect((aiCfgRes.body as { hasApiKey: boolean; maskedApiKey: string }).hasApiKey).toBe(true);
    expect((aiCfgRes.body as { maskedApiKey: string }).maskedApiKey).toContain('••••');
    expect(JSON.stringify(aiCfgRes.body)).not.toContain('sk-super-secret-e2e-123456');

    const publicCfgRes = await request(server).get('/api/v1/system-settings/config').expect(200);
    expect(JSON.stringify(publicCfgRes.body)).not.toContain('OPENAI');
    expect(JSON.stringify(publicCfgRes.body)).not.toContain('gpt-6-luna');
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
          { questionId: questionIds.essay, answerPayload: { text: '我周末喜欢去图书馆看中文书。' } },
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

  it('verifies P1/P2 audit fixes: key binding, SSRF/Zero-PII/batch-AI guards, concurrent confirm/publish locks, AdjustGrade 409/400, overdue-zero per-question & 0.25 step', async () => {
    // 1. Key binding (#1), legacy Gemini URL normalization (#3), default models, and SSRF guard (#2)
    const initialSave = await superadminClient
      .put('/api/v1/system-settings/ai-grading')
      .send({ enabled: true, provider: 'OPENAI', apiKey: 'sk-openai-real-1234' })
      .expect(200);
    expect(initialSave.body).toMatchObject({
      provider: 'OPENAI',
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-6-luna',
      hasApiKey: true,
    });

    // Switching provider at enabled=true without new key is rejected; disabled save drops old key
    await superadminClient
      .put('/api/v1/system-settings/ai-grading')
      .send({ enabled: true, provider: 'GEMINI', apiKey: '' })
      .expect(400);
    await superadminClient
      .post('/api/v1/system-settings/ai-grading/test')
      .send({ provider: 'CUSTOM', baseUrl: 'https://example.com/v1', model: 'gpt-6-luna', apiKey: '••••••••1234' })
      .expect(400);

    const legacyGeminiSave = await superadminClient
      .put('/api/v1/system-settings/ai-grading')
      .send({
        enabled: false,
        provider: 'GEMINI',
        baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
        apiKey: '',
      })
      .expect(200);
    expect(legacyGeminiSave.body).toMatchObject({
      enabled: false,
      provider: 'GEMINI',
      baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
      model: 'gemini-3.5-flash-lite',
      hasApiKey: false,
    });

    // Trailing dot loopback SSRF bypass blocked
    await superadminClient
      .post('/api/v1/system-settings/ai-grading/test')
      .send({
        provider: 'CUSTOM',
        baseUrl: 'https://localhost./v1',
        model: 'gpt-6-luna',
        apiKey: 'sk-test-local-1234',
      })
      .expect(400);

    // 2. Question points must be multiple of 0.25 (#9)
    const badAsmRes = await teacherClient
      .post('/api/v1/assessments')
      .send({ title: 'Test 0.25 Validation', type: AssessmentType.MINI_TEST, courseId, durationMinutes: 15 })
      .expect(201);
    const badAsmId = (badAsmRes.body as { id: string }).id;
    await teacherClient
      .post(`/api/v1/assessments/${badAsmId}/questions`)
      .send({
        type: 'SINGLE_CHOICE',
        prompt: 'Câu 0.9đ bị từ chối',
        points: 0.9,
        payload: { options: [{ id: 'a', text: 'A' }], correctOptionIds: ['a'] },
      })
      .expect(400);

    // Zero-PII fallback (#6) rejects self-intro prompt without writing PENDING_AI (#10)
    const piiQIdRes = await teacherClient
      .post(`/api/v1/assessments/${badAsmId}/questions`)
      .send({
        type: 'ESSAY',
        prompt: 'Viết đoạn tự giới thiệu bản thân',
        points: 2,
        payload: { sampleAnswer: 'Tôi tên An', rubric: 'HSK1' },
      })
      .expect(201);
    const piiQId = (piiQIdRes.body as { id: string }).id;
    await teacherClient.post(`/api/v1/assessments/${badAsmId}/publish`).expect(201);
    const piiAssignRes = await teacherClient
      .post(`/api/v1/assessments/${badAsmId}/assign`)
      .send({ classIds: [classId], dueAt: toVnOffsetIso(new Date(Date.now() + 86_400_000)) })
      .expect(201);
    const piiAssignId = (piiAssignRes.body as { items: Array<{ id: string }> }).items[0]!.id;

    const piiStart = await studentAClient
      .post(`/api/v1/assignments/${piiAssignId}/submissions/start`)
      .expect(200);
    const piiSubId = (piiStart.body as { submission: { id: string } }).submission.id;
    await studentAClient
      .post(`/api/v1/assignments/${piiAssignId}/submissions/submit`)
      .send({
        elapsedSeconds: 20,
        answers: [{ questionId: piiQId, answerPayload: { text: '我叫小王。' } }],
      })
      .expect(200);

    await superadminClient
      .put('/api/v1/system-settings/ai-grading')
      .send({ enabled: true, provider: 'OPENAI', apiKey: 'sk-dummy-active-1234' })
      .expect(200);

    await teacherClient.post(`/api/v1/submissions/${piiSubId}/ai-grade`).send({}).expect(400);
    const piiSubDb = await harness.prisma.submission.findUnique({ where: { id: piiSubId } });
    expect(piiSubDb?.gradingStatus).toBe(GradingStatus.NONE);

    // 3. Concurrent Confirm/Publish locking (#4), Objective submit scoring (#9), AdjustGrade 409/400 (#5), Overdue-zero per-question (#8), Batch AI (#11)
    const { assignmentId, questionIds } = await createAndAssignMixedAssessment();

    const startA = await studentAClient.post(`/api/v1/assignments/${assignmentId}/submissions/start`).expect(200);
    const subAId = (startA.body as { submission: { id: string } }).submission.id;
    await studentAClient
      .post(`/api/v1/assignments/${assignmentId}/submissions/submit`)
      .send({
        elapsedSeconds: 60,
        answers: [
          { questionId: questionIds.single, answerPayload: { selectedOptionIds: ['a'] } },
          { questionId: questionIds.multi, answerPayload: { selectedOptionIds: ['a'] } },
          { questionId: questionIds.fill, answerPayload: { text: '是' } },
          { questionId: questionIds.ordering, answerPayload: { orderedTokens: ['我', '是', '学生'] } },
          { questionId: questionIds.essay, answerPayload: { text: '我每天下午都看书。' } },
        ],
      })
      .expect(200);

    // Objective earnedPoints persisted immediately on submit (#9)
    const singleAnsDb = await harness.prisma.submissionAnswer.findUnique({
      where: { submissionId_questionId: { submissionId: subAId, questionId: questionIds.single } },
    });
    expect(Number(singleAnsDb?.earnedPoints)).toBe(2);
    expect(singleAnsDb?.isCorrect).toBe(true);

    // Batch AI max > 20 rejected (#11)
    const tooManyIds = Array.from({ length: 21 }, (_, idx) => `00000000-0000-4000-8000-${String(idx).padStart(12, '0')}`);
    await teacherClient
      .post(`/api/v1/assignments/${assignmentId}/ai-grade`)
      .send({ submissionIds: tooManyIds })
      .expect(400);

    // Initial essay score = 1 -> totalScore currently 6 in DB
    await teacherClient
      .patch(`/api/v1/submissions/${subAId}/manual-grade`)
      .send({ answers: [{ questionId: questionIds.essay, earnedPoints: 1 }] })
      .expect(200);

    // Two concurrent transactions (#4a): Tx1 holds submission lock, updates essay answer to 3.5 (without updating submission.totalScore) while confirm-grades waits on lock
    let releaseConfirmLock!: () => void;
    const confirmLockGate = new Promise<void>((resolve) => {
      releaseConfirmLock = resolve;
    });
    const tx1Promise = harness.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "submissions" WHERE id = ${subAId} FOR UPDATE`;
      await tx.submissionAnswer.update({
        where: { submissionId_questionId: { submissionId: subAId, questionId: questionIds.essay } },
        data: { earnedPoints: 3.5 },
      });
      await confirmLockGate;
    });

    const confirmReqPromise = teacherClient
      .post(`/api/v1/assignments/${assignmentId}/confirm-grades`)
      .send({ submissionIds: [subAId] });

    await new Promise((resolve) => setTimeout(resolve, 150));
    releaseConfirmLock();
    await tx1Promise;
    const confirmBatchRes = await confirmReqPromise.expect(200);
    expect(confirmBatchRes.body).toMatchObject({ confirmedCount: 1, confirmedSubmissionIds: [subAId] });

    const subAAfterConfirm = await harness.prisma.submission.findUnique({ where: { id: subAId } });
    expect(subAAfterConfirm?.status).toBe(SubmissionStatus.GRADED);
    expect(Number(subAAfterConfirm?.totalScore)).toBe(8.5); // 5 + 3.5, NOT stale 6!

    // Block auto-grade (#8), single AI (#10), and batch AI (#11) once GRADED
    await teacherClient.post(`/api/v1/submissions/${subAId}/auto-grade`).expect(409);
    await teacherClient.post(`/api/v1/submissions/${subAId}/ai-grade`).send({}).expect(409);
    const batchGradRes = await teacherClient
      .post(`/api/v1/assignments/${assignmentId}/ai-grade`)
      .send({ submissionIds: [subAId] })
      .expect(200);
    expect(batchGradRes.body).toMatchObject({
      requestedCount: 1,
      succeededCount: 0,
      failedCount: 1,
    });

    // Student B autosaves correct objective answer, never submits; assign dueAt expires -> overdue-zero zeroes submission & answers (#8)
    await studentBClient.post(`/api/v1/assignments/${assignmentId}/submissions/start`).expect(200);
    await studentBClient
      .patch(`/api/v1/assignments/${assignmentId}/submissions/autosave`)
      .send({
        elapsedSeconds: 30,
        remainingSeconds: 1700,
        answers: [{ questionId: questionIds.single, answerPayload: { selectedOptionIds: ['a'] } }],
      })
      .expect(200);

    await harness.prisma.classAssignment.update({
      where: { id: assignmentId },
      data: { dueAt: new Date(Date.now() - 86_400_000) },
    });

    // Overdue-zero refuses already submitted Student A (409), succeeds for Student B
    await teacherClient
      .post(`/api/v1/assignments/${assignmentId}/overdue-zero`)
      .send({ studentIds: [studentAId] })
      .expect(409);
    const overdueRes = await teacherClient
      .post(`/api/v1/assignments/${assignmentId}/overdue-zero`)
      .send({ studentIds: [studentBId], reason: 'Quá hạn chưa nộp' })
      .expect(200);
    expect((overdueRes.body as { recordedCount: number }).recordedCount).toBe(1);

    const subBDb = await harness.prisma.submission.findFirst({
      where: { classAssignmentId: assignmentId, studentId: studentBId },
      include: { answers: true },
    });
    expect(subBDb?.status).toBe(SubmissionStatus.GRADED);
    expect(Number(subBDb?.totalScore)).toBe(0);
    const stuBSingleAns = subBDb?.answers.find((a) => a.questionId === questionIds.single);
    expect(Number(stuBSingleAns?.earnedPoints)).toBe(0);
    expect(stuBSingleAns?.teacherEdited).toBe(true);
    expect(stuBSingleAns?.answerPayload).toEqual({ selectedOptionIds: ['a'] });

    // Two concurrent transactions (#4b): Tx2 holds class_assignment lock and marks subBId SUPERSEDED (simulating reopen), publish-grades only transitions subAId
    let releasePublishLock!: () => void;
    const publishLockGate = new Promise<void>((resolve) => {
      releasePublishLock = resolve;
    });
    const tx2Promise = harness.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "class_assignments" WHERE id = ${assignmentId} FOR UPDATE`;
      await tx.submission.update({
        where: { id: subBDb!.id },
        data: { status: SubmissionStatus.SUPERSEDED },
      });
      await publishLockGate;
    });
    const publishReqPromise = teacherClient.post(`/api/v1/assignments/${assignmentId}/publish-grades`).send({});
    await new Promise((resolve) => setTimeout(resolve, 150));
    releasePublishLock();
    await tx2Promise;
    const pubBatchRes = await publishReqPromise.expect(200);
    expect(pubBatchRes.body).toMatchObject({
      publishedCount: 1,
      publishedSubmissionIds: [subAId],
    });
    const subBFinal = await harness.prisma.submission.findUnique({ where: { id: subBDb!.id } });
    expect(subBFinal?.status).toBe(SubmissionStatus.SUPERSEDED);

    // AdjustGrade partial diffs, 409 conflict, duplicate questionId 400, comment-only preserves totalScore (#5)
    // Tab 1 edits ONLY single (2 -> 1.5); Tab 2 (opened earlier) edits ONLY essay (3.5 -> 4) -> both kept!
    const tab1Res = await teacherClient
      .patch(`/api/v1/submissions/${subAId}/adjust-grade`)
      .send({
        reason: 'Tab 1 chỉnh câu 1',
        answers: [{ questionId: questionIds.single, earnedPoints: 1.5, previousEarnedPoints: 2 }],
      })
      .expect(200);
    expect((tab1Res.body as { totalScore: number }).totalScore).toBe(8);

    const tab2Res = await teacherClient
      .patch(`/api/v1/submissions/${subAId}/adjust-grade`)
      .send({
        reason: 'Tab 2 chỉnh câu tự luận',
        answers: [{ questionId: questionIds.essay, earnedPoints: 4, previousEarnedPoints: 3.5 }],
      })
      .expect(200);
    expect((tab2Res.body as { totalScore: number }).totalScore).toBe(8.5);

    // Stale Tab 3 editing same single question receives 409
    await teacherClient
      .patch(`/api/v1/submissions/${subAId}/adjust-grade`)
      .send({
        reason: 'Tab 3 ghi đè cũ',
        answers: [{ questionId: questionIds.single, earnedPoints: 1.75, previousEarnedPoints: 2 }],
      })
      .expect(409);

    const logsBeforeDup = await harness.prisma.gradeAuditLog.count({ where: { submissionId: subAId } });
    await teacherClient
      .patch(`/api/v1/submissions/${subAId}/adjust-grade`)
      .send({
        reason: 'ID trùng',
        answers: [
          { questionId: questionIds.essay, earnedPoints: 3 },
          { questionId: questionIds.essay, earnedPoints: 4 },
        ],
      })
      .expect(400);
    const logsAfterDup = await harness.prisma.gradeAuditLog.count({ where: { submissionId: subAId } });
    expect(logsAfterDup).toBe(logsBeforeDup);

    // Comment-only edit preserves totalScore & creates 0 audit logs
    const commentRes = await teacherClient
      .patch(`/api/v1/submissions/${subAId}/adjust-grade`)
      .send({
        reason: 'Bổ sung nhận xét câu tự luận',
        answers: [
          {
            questionId: questionIds.essay,
            teacherComment: 'Nhận xét chi tiết mới',
            previousTeacherComment: null,
          },
        ],
      })
      .expect(200);
    expect(commentRes.body).toMatchObject({ totalScore: 8.5, auditLogsCreated: 0 });
  });
});
