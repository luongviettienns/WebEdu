import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import {
  AssessmentType,
  ClassStatus,
  CourseLevel,
  EnrollmentStatus,
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

const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(256, 1),
]);
const MP3 = Buffer.concat([
  Buffer.from('ID3'),
  Buffer.from([0x04, 0x00, 0x00]),
  Buffer.alloc(256, 2),
]);

const FORBIDDEN_SECRET_KEYS = [
  'correctOptionIds',
  'acceptedAnswers',
  'correctSentence',
  'sampleAnswer',
  'rubric',
  'explanation',
] as const;

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

function collectAllKeys(value: unknown, keys: string[] = []): string[] {
  if (Array.isArray(value)) {
    for (const item of value) collectAllKeys(item, keys);
    return keys;
  }
  if (value !== null && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      keys.push(k);
      collectAllKeys(v, keys);
    }
  }
  return keys;
}

function toVnOffsetIso(date: Date): string {
  const vnDate = new Date(date.getTime() + 7 * 60 * 60 * 1000);
  return `${vnDate.toISOString().slice(0, 19)}+07:00`;
}

function readProblemDetail(res: request.Response): string {
  const payload =
    res.body && typeof res.body === 'object' && 'detail' in res.body
      ? (res.body as { detail: string })
      : (JSON.parse(res.text) as { detail: string });
  return payload.detail;
}

describe('Phase 6 Assignment Delivery, Exam Taking & Reopen E2E (Real PostgreSQL)', () => {
  let harness: RealE2eAppHarness;
  let server: Server;
  let uploadDir: string;
  let passwordHash: string;

  let courseId: string;
  let classId: string;
  let teacherId: string;
  let otherTeacherId: string;
  let studentId: string;
  let droppedStudentId: string;
  let outsideStudentId: string;

  let teacherClient: Client;
  let otherTeacherClient: Client;
  let studentClient: Client;
  let droppedClient: Client;
  let outsideClient: Client;

  beforeAll(async () => {
    uploadDir = fs.mkdtempSync(path.join(os.tmpdir(), 'webedu-p6-uploads-'));
    process.env.UPLOAD_DIR = uploadDir;
    passwordHash = await bcrypt.hash(PASSWORD, 10);
    harness = await createRealE2eAppHarness();
    server = harness.app.getHttpServer() as Server;
  });

  afterAll(async () => {
    if (harness) await harness.stop();
    delete process.env.UPLOAD_DIR;
    fs.rmSync(uploadDir, { recursive: true, force: true });
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
    for (const f of fs.readdirSync(uploadDir)) fs.rmSync(path.join(uploadDir, f), { force: true });

    const course = await harness.prisma.course.create({
      data: { code: 'HSK1-P6', name: 'Tiếng Trung HSK 1', level: CourseLevel.HSK1 },
    });
    courseId = course.id;

    const teacher = await seedAndLoginUser('gv.main@webedu.vn', [Role.TEACHER], '0906000001', 'Cô Lan');
    const otherTeacher = await seedAndLoginUser('gv.other@webedu.vn', [Role.TEACHER], '0906000002', 'Thầy Minh');
    const stu = await seedAndLoginUser('hv.active@webedu.vn', [Role.STUDENT], '0906000003', 'Nguyễn An');
    const dropped = await seedAndLoginUser('hv.dropped@webedu.vn', [Role.STUDENT], '0906000004', 'Trần Bình');
    const outside = await seedAndLoginUser('hv.outside@webedu.vn', [Role.STUDENT], '0906000005', 'Lê Chi');

    teacherId = teacher.id;
    otherTeacherId = otherTeacher.id;
    teacherClient = teacher.client;
    otherTeacherClient = otherTeacher.client;
    studentId = stu.id;
    studentClient = stu.client;
    droppedStudentId = dropped.id;
    droppedClient = dropped.client;
    outsideStudentId = outside.id;
    outsideClient = outside.client;

    const cls = await harness.prisma.class.create({
      data: {
        code: 'HSK1-K26-P6',
        courseId,
        teacherId,
        status: ClassStatus.ACTIVE,
        startDate: new Date('2026-10-01T00:00:00.000Z'),
      },
    });
    classId = cls.id;

    await harness.prisma.enrollment.create({
      data: {
        classId,
        studentId,
        status: EnrollmentStatus.ACTIVE,
        enrolledDate: new Date('2026-10-01T00:00:00.000Z'),
      },
    });
    await harness.prisma.enrollment.create({
      data: {
        classId,
        studentId: droppedStudentId,
        status: EnrollmentStatus.DROPPED,
        enrolledDate: new Date('2026-10-01T00:00:00.000Z'),
        leftDate: new Date('2026-10-15T00:00:00.000Z'),
      },
    });
  });

  async function buildPublishedAll7TypesAssessment(): Promise<{
    assessmentId: string;
    audioId: string;
    imageId: string;
    questionIds: Record<string, string>;
  }> {
    const createRes = await teacherClient
      .post('/api/v1/assessments')
      .send({
        title: 'Đề tổng hợp 7 dạng HSK 1',
        type: AssessmentType.MINI_TEST,
        courseId,
        durationMinutes: 30,
      })
      .expect(201);
    const assessmentId = (createRes.body as { id: string }).id;

    const audioRes = await teacherClient
      .post(`/api/v1/assessments/${assessmentId}/media`)
      .attach('file', MP3, { filename: 'listen.mp3', contentType: 'audio/mpeg' })
      .expect(201);
    const audioId = (audioRes.body as { id: string }).id;

    const imgRes = await teacherClient
      .post(`/api/v1/assessments/${assessmentId}/media`)
      .attach('file', PNG, { filename: 'stem.png', contentType: 'image/png' })
      .expect(201);
    const imageId = (imgRes.body as { id: string }).id;

    const defs: Array<{ key: string; body: Record<string, unknown> }> = [
      {
        key: 'single',
        body: {
          type: 'SINGLE_CHOICE',
          prompt: 'Chọn nghĩa 你好',
          points: 1,
          payload: {
            options: [
              { id: 'a', text: 'Xin chào' },
              { id: 'b', text: 'Tạm biệt' },
            ],
            correctOptionIds: ['a'],
            explanation: 'Secret single explanation',
          },
        },
      },
      {
        key: 'multiple',
        body: {
          type: 'MULTIPLE_CHOICE',
          prompt: 'Chọn danh từ',
          points: 2,
          payload: {
            options: [
              { id: 'a', text: '书' },
              { id: 'b', text: '人' },
              { id: 'c', text: '跑' },
            ],
            correctOptionIds: ['a', 'b'],
            explanation: 'Secret multiple explanation',
          },
        },
      },
      {
        key: 'fill',
        body: {
          type: 'FILL_BLANK',
          prompt: '我___学生',
          points: 1,
          payload: {
            acceptedAnswers: ['是'],
            caseSensitive: false,
            pinyinSensitive: true,
            explanation: 'Secret fill explanation',
          },
        },
      },
      {
        key: 'ordering',
        body: {
          type: 'ORDERING',
          prompt: 'Sắp xếp thành câu đúng',
          points: 2,
          payload: {
            tokens: ['我', '是', '学生'],
            correctSentence: '我是学生',
            explanation: 'Secret ordering explanation',
          },
        },
      },
      {
        key: 'essay',
        body: {
          type: 'ESSAY',
          prompt: 'Viết đoạn giới thiệu bản thân',
          points: 4,
          payload: {
            sampleAnswer: '我叫小明',
            rubric: 'Nêu tên và nghề nghiệp',
            maxLength: 500,
            explanation: 'Secret essay explanation',
          },
        },
      },
      {
        key: 'listening',
        body: {
          type: 'LISTENING',
          prompt: 'Nghe và chọn đáp án đúng',
          points: 2,
          payload: {
            mediaId: audioId,
            maxListens: 2,
            options: [
              { id: 'a', text: '今天天气很好' },
              { id: 'b', text: '明天见' },
            ],
            correctOptionIds: ['a'],
            sampleAnswer: 'Secret transcript',
            explanation: 'Secret listening explanation',
          },
        },
      },
      {
        key: 'image',
        body: {
          type: 'IMAGE_BASED',
          prompt: 'Nhìn ảnh chọn từ đúng',
          points: 2,
          payload: {
            mediaId: imageId,
            caption: 'Gia đình',
            multiple: false,
            options: [
              { id: 'a', text: '猫' },
              { id: 'b', text: '狗' },
            ],
            correctOptionIds: ['a'],
            explanation: 'Secret image explanation',
          },
        },
      },
    ];

    const questionIds: Record<string, string> = {};
    for (const def of defs) {
      const qRes = await teacherClient
        .post(`/api/v1/assessments/${assessmentId}/questions`)
        .send(def.body)
        .expect(201);
      questionIds[def.key] = (qRes.body as { id: string }).id;
    }

    await teacherClient.post(`/api/v1/assessments/${assessmentId}/publish`).expect(201);
    return { assessmentId, audioId, imageId, questionIds };
  }

  it('Scenario 1: assigns PUBLISHED assessment (201), rejects DRAFT (400) & unassigned teacher (403), updates assignedClassCount to 1', async () => {
    const draftRes = await teacherClient
      .post('/api/v1/assessments')
      .send({ title: 'Đề nháp', type: AssessmentType.HOMEWORK, courseId })
      .expect(201);
    const draftId = (draftRes.body as { id: string }).id;
    const futureDue = new Date(Date.now() + 86_400_000).toISOString();

    await teacherClient
      .post(`/api/v1/assessments/${draftId}/assign`)
      .send({ classIds: [classId], dueAt: futureDue })
      .expect(400);

    const { assessmentId } = await buildPublishedAll7TypesAssessment();

    await otherTeacherClient
      .post(`/api/v1/assessments/${assessmentId}/assign`)
      .send({ classIds: [classId], dueAt: futureDue })
      .expect(403);

    const assignRes = await teacherClient
      .post(`/api/v1/assessments/${assessmentId}/assign`)
      .send({ classIds: [classId], dueAt: futureDue, instructions: 'Làm nghiêm túc' })
      .expect(201);
    const assignBody = assignRes.body as { items: Array<{ id: string; classId: string }> };
    expect(assignBody.items).toHaveLength(1);
    expect(assignBody.items[0]?.classId).toBe(classId);

    const listRes = await teacherClient.get('/api/v1/assessments').expect(200);
    const items = (listRes.body as { items: Array<{ id: string; assignedClassCount: number }> }).items;
    const matched = items.find((a) => a.id === assessmentId);
    expect(matched?.assignedClassCount).toBe(1);

    const classListTeacher = await teacherClient
      .get(`/api/v1/classes/${classId}/assignments`)
      .expect(200);
    expect(
      (classListTeacher.body as { items: Array<{ stats?: { totalStudents: number } }> }).items[0]
        ?.stats?.totalStudents,
    ).toBe(1);

    const classListStudent = await studentClient
      .get(`/api/v1/classes/${classId}/assignments`)
      .expect(200);
    const studentItem = (classListStudent.body as { items: Array<Record<string, unknown>> }).items[0]!;
    expect('stats' in studentItem).toBe(false);
  });

  it('Scenarios 2-6 & 8: Zero-Leak start across 7 types, autosave + maxListens cap, 5-way submit race, read-only view, DROPPED/outside 403, and Reopen Attempt #2', async () => {
    const { assessmentId, audioId, questionIds } = await buildPublishedAll7TypesAssessment();
    const futureDue = new Date(Date.now() + 86_400_000).toISOString();
    const assignRes = await teacherClient
      .post(`/api/v1/assessments/${assessmentId}/assign`)
      .send({ classIds: [classId], dueAt: futureDue })
      .expect(201);
    const assignmentId = (assignRes.body as { items: Array<{ id: string }> }).items[0]!.id;

    // Scenario 2: Student lists /assignments/me and starts exam
    const myList = await studentClient.get('/api/v1/assignments/me').expect(200);
    expect((myList.body as { items: Array<{ assignmentId: string }> }).items[0]?.assignmentId).toBe(
      assignmentId,
    );

    const startRes = await studentClient
      .post(`/api/v1/assignments/${assignmentId}/submissions/start`)
      .expect(200);
    const startText = JSON.stringify(startRes.body);
    const startKeys = collectAllKeys(startRes.body);
    for (const secret of FORBIDDEN_SECRET_KEYS) {
      expect(startKeys).not.toContain(secret);
      expect(startText).not.toContain(secret);
    }
    const startedSession = startRes.body as {
      submission: { id: string; status: string; remainingSeconds: number };
      questions: Array<{ id: string; type: string; tokens?: string[] }>;
    };
    expect(startedSession.submission.status).toBe(SubmissionStatus.IN_PROGRESS);
    expect(startedSession.submission.remainingSeconds).toBe(1800);
    expect(startedSession.questions).toHaveLength(7);

    // Media streaming works for enrolled student with nosniff header
    const mediaRes = await studentClient
      .get(`/api/v1/assignments/${assignmentId}/media/${audioId}`)
      .expect(200);
    expect(mediaRes.headers['x-content-type-options']).toBe('nosniff');

    // Scenario 3: Autosave answers + monotonic timer + maxListens enforcement
    const save1 = await studentClient
      .patch(`/api/v1/assignments/${assignmentId}/submissions/autosave`)
      .send({
        elapsedSeconds: 45,
        remainingSeconds: 1755,
        answers: [
          { questionId: questionIds.single, answerPayload: { selectedOptionIds: ['a'] } },
          { questionId: questionIds.fill, answerPayload: { text: '是' } },
          {
            questionId: questionIds.listening,
            answerPayload: { selectedOptionIds: ['a'] },
            audioPlayCount: 2,
          },
        ],
      })
      .expect(200);
    const saved1 = save1.body as {
      submission: { elapsedSeconds: number; remainingSeconds: number };
      answers: Array<{ questionId: string }>;
    };
    expect(saved1.submission.elapsedSeconds).toBe(45);
    expect(saved1.submission.remainingSeconds).toBe(1755);
    expect(saved1.answers).toHaveLength(3);

    // Clock rollback attempt stays monotonic (45 & 1755)
    const saveClamped = await studentClient
      .patch(`/api/v1/assignments/${assignmentId}/submissions/autosave`)
      .send({
        elapsedSeconds: 10,
        remainingSeconds: 1795,
        answers: [{ questionId: questionIds.essay, answerPayload: { text: '我叫安' } }],
      })
      .expect(200);
    const clampedBody = saveClamped.body as {
      submission: { elapsedSeconds: number; remainingSeconds: number };
    };
    expect(clampedBody.submission.elapsedSeconds).toBe(45);
    expect(clampedBody.submission.remainingSeconds).toBe(1755);

    // Exceeding maxListens (2 -> 3) returns 400
    await studentClient
      .patch(`/api/v1/assignments/${assignmentId}/submissions/autosave`)
      .send({
        elapsedSeconds: 50,
        remainingSeconds: 1750,
        answers: [
          {
            questionId: questionIds.listening,
            answerPayload: { selectedOptionIds: ['a'] },
            audioPlayCount: 3,
          },
        ],
      })
      .expect(400);

    // Scenario 6: DROPPED student & un-enrolled student receive 403 on all student exam endpoints & media
    for (const forbiddenClient of [droppedClient, outsideClient]) {
      await forbiddenClient.post(`/api/v1/assignments/${assignmentId}/submissions/start`).expect(403);
      await forbiddenClient
        .patch(`/api/v1/assignments/${assignmentId}/submissions/autosave`)
        .send({ elapsedSeconds: 5, answers: [] })
        .expect(403);
      await forbiddenClient.post(`/api/v1/assignments/${assignmentId}/submissions/submit`).send({}).expect(403);
      await forbiddenClient.get(`/api/v1/assignments/${assignmentId}/submissions/me`).expect(403);
      await forbiddenClient.get(`/api/v1/assignments/${assignmentId}/media/${audioId}`).expect(403);
    }
    expect(outsideStudentId).toBeTruthy();

    // Scenario 4: 5-way concurrent POST /submissions/submit race -> 1x 200, 4x 409, 1 active row in DB
    const submitResults = await Promise.all(
      Array.from({ length: 5 }, () =>
        studentClient
          .post(`/api/v1/assignments/${assignmentId}/submissions/submit`)
          .send({ elapsedSeconds: 60, remainingSeconds: 1740 }),
      ),
    );
    const statuses = submitResults.map((r) => r.status);
    expect(statuses.filter((s) => s === 200)).toHaveLength(1);
    expect(statuses.filter((s) => s === 409)).toHaveLength(4);

    const activeInDb = await harness.prisma.submission.count({
      where: {
        classAssignmentId: assignmentId,
        studentId,
        status: { not: SubmissionStatus.SUPERSEDED },
      },
    });
    expect(activeInDb).toBe(1);

    // Scenario 5: Read-only submitted view returns 200 SUBMITTED_WAITING (Zero-Leak), while autosave/submit return 409
    const submittedView = await studentClient
      .get(`/api/v1/assignments/${assignmentId}/submissions/me`)
      .expect(200);
    const submittedText = JSON.stringify(submittedView.body);
    for (const secret of FORBIDDEN_SECRET_KEYS) {
      expect(submittedText).not.toContain(secret);
    }
    expect(
      (submittedView.body as { submission: { status: string } }).submission.status,
    ).toBe(SubmissionStatus.SUBMITTED_WAITING);

    await studentClient
      .patch(`/api/v1/assignments/${assignmentId}/submissions/autosave`)
      .send({ elapsedSeconds: 70, answers: [] })
      .expect(409);
    await studentClient
      .post(`/api/v1/assignments/${assignmentId}/submissions/submit`)
      .send({})
      .expect(409);

    // Scenario 8: Teacher reopens submission -> old SUPERSEDED, ReopenLog in DB, Attempt #2 IN_PROGRESS preserving answers, student edits & submits Attempt #2
    const trackerBefore = await teacherClient
      .get(`/api/v1/assignments/${assignmentId}/submissions`)
      .expect(200);
    const firstSubmissionId = (
      trackerBefore.body as { students: Array<{ submissionId: string }> }
    ).students[0]!.submissionId;

    const reopenRes = await teacherClient
      .post(`/api/v1/submissions/${firstSubmissionId}/reopen`)
      .send({ reason: 'Học viên rớt mạng giữa bài' })
      .expect(200);
    const reopenedRow = reopenRes.body as {
      attemptNumber: number;
      status: string;
      canReopen: boolean;
      reopenCount: number;
      supersededAttempts: Array<{ submissionId: string; reopenReason: string }>;
    };
    expect(reopenedRow.attemptNumber).toBe(2);
    expect(reopenedRow.status).toBe(SubmissionStatus.IN_PROGRESS);
    expect(reopenedRow.canReopen).toBe(false);
    expect(reopenedRow.reopenCount).toBe(1);
    expect(reopenedRow.supersededAttempts[0]?.submissionId).toBe(firstSubmissionId);
    expect(reopenedRow.supersededAttempts[0]?.reopenReason).toBe('Học viên rớt mạng giữa bài');

    const oldSub = await harness.prisma.submission.findUniqueOrThrow({
      where: { id: firstSubmissionId },
    });
    expect(oldSub.status).toBe(SubmissionStatus.SUPERSEDED);
    const reopenLogCount = await harness.prisma.submissionReopenLog.count({
      where: { submissionId: firstSubmissionId },
    });
    expect(reopenLogCount).toBe(1);

    const resumeAttempt2 = await studentClient
      .post(`/api/v1/assignments/${assignmentId}/submissions/start`)
      .expect(200);
    const attempt2Body = resumeAttempt2.body as {
      submission: { attemptNumber: number; reopenReason: string | null };
      answers: Array<{ questionId: string; answerPayload: Record<string, unknown> }>;
    };
    expect(attempt2Body.submission.attemptNumber).toBe(2);
    expect(attempt2Body.submission.reopenReason).toBe('Học viên rớt mạng giữa bài');
    expect(attempt2Body.answers.length).toBeGreaterThanOrEqual(4);

    // Student edits and submits Attempt #2
    await studentClient
      .post(`/api/v1/assignments/${assignmentId}/submissions/submit`)
      .send({
        elapsedSeconds: 120,
        remainingSeconds: 1680,
        answers: [{ questionId: questionIds.single, answerPayload: { selectedOptionIds: ['b'] } }],
      })
      .expect(200);

    const finalView = await studentClient
      .get(`/api/v1/assignments/${assignmentId}/submissions/me`)
      .expect(200);
    expect((finalView.body as { submission: { attemptNumber: number } }).submission.attemptNumber).toBe(2);
  });

  it('Scenario 7: Timer expiry (autosave with remainingSeconds: 0) triggers automatic submission', async () => {
    const { assessmentId } = await buildPublishedAll7TypesAssessment();
    const futureDue = new Date(Date.now() + 86_400_000).toISOString();
    const assignRes = await teacherClient
      .post(`/api/v1/assessments/${assessmentId}/assign`)
      .send({ classIds: [classId], dueAt: futureDue })
      .expect(201);
    const assignmentId = (assignRes.body as { items: Array<{ id: string }> }).items[0]!.id;

    await studentClient.post(`/api/v1/assignments/${assignmentId}/submissions/start`).expect(200);

    const expiredRes = await studentClient
      .patch(`/api/v1/assignments/${assignmentId}/submissions/autosave`)
      .send({ elapsedSeconds: 1800, remainingSeconds: 0, answers: [] })
      .expect(200);

    const body = expiredRes.body as {
      submission: { status: string; autoSubmitted: boolean; remainingSeconds: number };
    };
    expect(body.submission.status).toBe(SubmissionStatus.SUBMITTED_WAITING);
    expect(body.submission.autoSubmitted).toBe(true);
    expect(body.submission.remainingSeconds).toBe(0);
  });

  it('Scenario 9 (Audit #13.1): Reopening Student A with future +07:00 newDueAt keeps classAssignment.dueAt immutable and preserves Student B overdue block', async () => {
    const studentB = await seedAndLoginUser(
      'hv.studentb@webedu.vn',
      [Role.STUDENT],
      '0906000010',
      'Phạm Dung',
    );
    await harness.prisma.enrollment.create({
      data: {
        classId,
        studentId: studentB.id,
        status: EnrollmentStatus.ACTIVE,
        enrolledDate: new Date('2026-10-01T00:00:00.000Z'),
      },
    });

    const { assessmentId, questionIds } = await buildPublishedAll7TypesAssessment();
    const initialFutureDue = new Date(Date.now() + 86_400_000).toISOString();
    const assignRes = await teacherClient
      .post(`/api/v1/assessments/${assessmentId}/assign`)
      .send({ classIds: [classId], dueAt: initialFutureDue })
      .expect(201);
    const assignmentId = (assignRes.body as { items: Array<{ id: string }> }).items[0]!.id;

    // Student A completes Attempt #1 before deadline
    const startA1 = await studentClient
      .post(`/api/v1/assignments/${assignmentId}/submissions/start`)
      .expect(200);
    const firstSubmissionId = (startA1.body as { submission: { id: string } }).submission.id;
    await studentClient
      .post(`/api/v1/assignments/${assignmentId}/submissions/submit`)
      .send({
        elapsedSeconds: 30,
        remainingSeconds: 1770,
        answers: [{ questionId: questionIds.single, answerPayload: { selectedOptionIds: ['a'] } }],
      })
      .expect(200);

    // Backdate classAssignment.dueAt into the past
    const pastDue = new Date(Date.now() - 3_600_000);
    await harness.prisma.classAssignment.update({
      where: { id: assignmentId },
      data: { dueAt: pastDue },
    });

    // Teacher reopens only Student A with a future +07:00 newDueAt
    const newDueAt = toVnOffsetIso(new Date(Date.now() + 72 * 3_600_000));
    const expectedOverrideIso = new Date(newDueAt).toISOString();
    await teacherClient
      .post(`/api/v1/submissions/${firstSubmissionId}/reopen`)
      .send({ reason: 'Gia hạn riêng cho học viên A', newDueAt })
      .expect(200);

    // classAssignment.dueAt remains unchanged; Student A Submission Attempt #2 has dueAtOverride
    const dbAssignment = await harness.prisma.classAssignment.findUniqueOrThrow({
      where: { id: assignmentId },
    });
    expect(dbAssignment.dueAt.toISOString()).toBe(pastDue.toISOString());

    const reopenedSub = await harness.prisma.submission.findFirstOrThrow({
      where: { classAssignmentId: assignmentId, studentId, attemptNumber: 2 },
    });
    expect(reopenedSub.dueAtOverride?.toISOString()).toBe(expectedOverrideIso);

    // Student A sees isOverdue=false and completes Attempt #2 after original dueAt
    const listARes = await studentClient.get('/api/v1/assignments/me').expect(200);
    const itemA = (
      listARes.body as { items: Array<{ assignmentId: string; dueAt: string; isOverdue: boolean }> }
    ).items.find((item) => item.assignmentId === assignmentId);
    expect(itemA?.dueAt).toBe(expectedOverrideIso);
    expect(itemA?.isOverdue).toBe(false);

    await studentClient.post(`/api/v1/assignments/${assignmentId}/submissions/start`).expect(200);
    await studentClient
      .patch(`/api/v1/assignments/${assignmentId}/submissions/autosave`)
      .send({
        elapsedSeconds: 45,
        remainingSeconds: 1755,
        answers: [{ questionId: questionIds.fill, answerPayload: { text: '是' } }],
      })
      .expect(200);
    await studentClient
      .post(`/api/v1/assignments/${assignmentId}/submissions/submit`)
      .send({ elapsedSeconds: 60, remainingSeconds: 1740 })
      .expect(200);

    // Student B still sees isOverdue=true and receives 400 on POST /start
    const listBRes = await studentB.client.get('/api/v1/assignments/me').expect(200);
    const itemB = (
      listBRes.body as { items: Array<{ assignmentId: string; dueAt: string; isOverdue: boolean }> }
    ).items.find((item) => item.assignmentId === assignmentId);
    expect(itemB?.dueAt).toBe(pastDue.toISOString());
    expect(itemB?.isOverdue).toBe(true);

    const startBRes = await studentB.client
      .post(`/api/v1/assignments/${assignmentId}/submissions/start`)
      .expect(400);
    expect(readProblemDetail(startBRes)).toContain('Đã quá hạn nộp bài');
  });

  it('Scenario 10 (Audit #13.2): Concurrent double-Start race recovers cleanly via P2002 with 1 DB row', async () => {
    const { assessmentId } = await buildPublishedAll7TypesAssessment();
    const futureDue = toVnOffsetIso(new Date(Date.now() + 86_400_000));
    const assignRes = await teacherClient
      .post(`/api/v1/assessments/${assessmentId}/assign`)
      .send({ classIds: [classId], dueAt: futureDue })
      .expect(201);
    const assignmentId = (assignRes.body as { items: Array<{ id: string }> }).items[0]!.id;

    const [res1, res2] = await Promise.all([
      studentClient.post(`/api/v1/assignments/${assignmentId}/submissions/start`),
      studentClient.post(`/api/v1/assignments/${assignmentId}/submissions/start`),
    ]);

    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);
    const body1 = res1.body as { submission: { id: string; attemptNumber: number } };
    const body2 = res2.body as { submission: { id: string; attemptNumber: number } };
    expect(body1.submission.id).toBe(body2.submission.id);
    expect(body1.submission.attemptNumber).toBe(1);

    const dbCount = await harness.prisma.submission.count({
      where: { classAssignmentId: assignmentId, studentId },
    });
    expect(dbCount).toBe(1);
  });

  it('Scenario 11 (Audit #13.3): Teacher history entry grants read-only access while unrelated teacher receives 403 on all class assignment routes', async () => {
    const unrelatedTeacher = await seedAndLoginUser(
      'gv.unrelated@webedu.vn',
      [Role.TEACHER],
      '0906000011',
      'Thầy Hùng',
    );
    const { assessmentId, audioId } = await buildPublishedAll7TypesAssessment();
    const futureDue = toVnOffsetIso(new Date(Date.now() + 86_400_000));
    const assignRes = await teacherClient
      .post(`/api/v1/assessments/${assessmentId}/assign`)
      .send({ classIds: [classId], dueAt: futureDue })
      .expect(201);
    const assignmentId = (assignRes.body as { items: Array<{ id: string }> }).items[0]!.id;

    // Seed a submission so reopen route checks class write ownership after loading submission
    const startRes = await studentClient
      .post(`/api/v1/assignments/${assignmentId}/submissions/start`)
      .expect(200);
    const submissionId = (startRes.body as { submission: { id: string } }).submission.id;
    await studentClient
      .post(`/api/v1/assignments/${assignmentId}/submissions/submit`)
      .send({ elapsedSeconds: 10 })
      .expect(200);

    // Attach otherTeacher via ClassTeacherAssignment with assignedTo: null while cls.teacherId stays teacherId
    await harness.prisma.classTeacherAssignment.create({
      data: {
        classId,
        teacherId: otherTeacherId,
        assignedFrom: new Date('2026-10-01T00:00:00.000Z'),
        assignedTo: null,
      },
    });

    // Co-teacher/history teacher has READ access (200) and NO WRITE access (403)
    await otherTeacherClient.get(`/api/v1/classes/${classId}/assignments`).expect(200);
    await otherTeacherClient.get(`/api/v1/assignments/${assignmentId}/submissions`).expect(200);
    await otherTeacherClient.get(`/api/v1/assignments/${assignmentId}/media/${audioId}`).expect(200);
    await otherTeacherClient
      .post(`/api/v1/assessments/${assessmentId}/assign`)
      .send({ classIds: [classId], dueAt: futureDue })
      .expect(403);
    await otherTeacherClient
      .post(`/api/v1/submissions/${submissionId}/reopen`)
      .send({ reason: 'Co-teacher cannot reopen' })
      .expect(403);

    // Unrelated teacher gets 403 on all read and write routes
    await unrelatedTeacher.client.get(`/api/v1/classes/${classId}/assignments`).expect(403);
    await unrelatedTeacher.client.get(`/api/v1/assignments/${assignmentId}/submissions`).expect(403);
    await unrelatedTeacher.client.get(`/api/v1/assignments/${assignmentId}/media/${audioId}`).expect(403);
    await unrelatedTeacher.client
      .post(`/api/v1/assessments/${assessmentId}/assign`)
      .send({ classIds: [classId], dueAt: futureDue })
      .expect(403);
    await unrelatedTeacher.client
      .post(`/api/v1/submissions/${submissionId}/reopen`)
      .send({ reason: 'Unrelated teacher cannot reopen' })
      .expect(403);
  });

  it('Scenario 12 (Audit #13.4): Media stream returns 404 across assessments, enforces maxListens=2 with no-store headers, and rejects stale autosave audioPlayCount desync', async () => {
    const { assessmentId, audioId, questionIds } = await buildPublishedAll7TypesAssessment();

    // Create a second assessment with its own uploaded media asset
    const otherAsmRes = await teacherClient
      .post('/api/v1/assessments')
      .send({
        title: 'Đề khác kiểm tra cách ly media',
        type: AssessmentType.HOMEWORK,
        courseId,
        durationMinutes: 15,
      })
      .expect(201);
    const otherAsmId = (otherAsmRes.body as { id: string }).id;
    const otherMediaRes = await teacherClient
      .post(`/api/v1/assessments/${otherAsmId}/media`)
      .attach('file', MP3, { filename: 'other-listen.mp3', contentType: 'audio/mpeg' })
      .expect(201);
    const otherAudioId = (otherMediaRes.body as { id: string }).id;

    const futureDue = toVnOffsetIso(new Date(Date.now() + 86_400_000));
    const assignRes = await teacherClient
      .post(`/api/v1/assessments/${assessmentId}/assign`)
      .send({ classIds: [classId], dueAt: futureDue })
      .expect(201);
    const assignmentId = (assignRes.body as { items: Array<{ id: string }> }).items[0]!.id;

    const startRes = await studentClient
      .post(`/api/v1/assignments/${assignmentId}/submissions/start`)
      .expect(200);
    const submissionId = (startRes.body as { submission: { id: string } }).submission.id;

    // Cross-assessment media asset returns 404 for both student and teacher
    await studentClient
      .get(`/api/v1/assignments/${assignmentId}/media/${otherAudioId}`)
      .expect(404);
    await teacherClient
      .get(`/api/v1/assignments/${assignmentId}/media/${otherAudioId}`)
      .expect(404);

    // Streams #1 and #2 succeed with Cache-Control: private, no-store and increment DB audioPlayCount to 2
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      const streamRes = await studentClient
        .get(`/api/v1/assignments/${assignmentId}/media/${audioId}`)
        .expect(200);
      expect(streamRes.headers['cache-control']).toBe('private, no-store');
      expect(streamRes.headers['x-content-type-options']).toBe('nosniff');
    }

    const answerAfterStreams = await harness.prisma.submissionAnswer.findUniqueOrThrow({
      where: {
        submissionId_questionId: {
          submissionId,
          questionId: questionIds.listening!,
        },
      },
    });
    expect(answerAfterStreams.audioPlayCount).toBe(2);

    // Stale client autosave sending audioPlayCount: 0 still succeeds (200) and DB remains 2
    const staleAutosaveRes = await studentClient
      .patch(`/api/v1/assignments/${assignmentId}/submissions/autosave`)
      .send({
        elapsedSeconds: 20,
        remainingSeconds: 1780,
        answers: [
          {
            questionId: questionIds.listening,
            answerPayload: { selectedOptionIds: ['a'] },
            audioPlayCount: 0,
          },
        ],
      })
      .expect(200);
    const listeningSaved = (
      staleAutosaveRes.body as { answers: Array<{ questionId: string; audioPlayCount: number }> }
    ).answers.find((ans) => ans.questionId === questionIds.listening);
    expect(listeningSaved?.audioPlayCount).toBe(2);

    const answerAfterStaleAutosave = await harness.prisma.submissionAnswer.findUniqueOrThrow({
      where: {
        submissionId_questionId: {
          submissionId,
          questionId: questionIds.listening!,
        },
      },
    });
    expect(answerAfterStaleAutosave.audioPlayCount).toBe(2);

    // Stream #3 exceeds maxListens=2 -> 400
    const thirdStreamRes = await studentClient
      .get(`/api/v1/assignments/${assignmentId}/media/${audioId}`)
      .expect(400);
    expect(readProblemDetail(thirdStreamRes)).toContain('Đã hết lượt nghe cho phép');
  });

  it('Scenario 13 (Audit #13.5): Enforces timezone offset dates, autosave array/duplicate bounds, and tracker pagination', async () => {
    const studentB = await seedAndLoginUser(
      'hv.page2@webedu.vn',
      [Role.STUDENT],
      '0906000012',
      'Vũ Minh',
    );
    await harness.prisma.enrollment.create({
      data: {
        classId,
        studentId: studentB.id,
        status: EnrollmentStatus.ACTIVE,
        enrolledDate: new Date('2026-10-01T00:00:00.000Z'),
      },
    });

    const { assessmentId, questionIds } = await buildPublishedAll7TypesAssessment();

    // Offset-less assign dueAt -> 400
    await teacherClient
      .post(`/api/v1/assessments/${assessmentId}/assign`)
      .send({ classIds: [classId], dueAt: '2027-12-01T23:59:00' })
      .expect(400);

    const futureDue = toVnOffsetIso(new Date(Date.now() + 86_400_000));
    const assignRes = await teacherClient
      .post(`/api/v1/assessments/${assessmentId}/assign`)
      .send({ classIds: [classId], dueAt: futureDue })
      .expect(201);
    const assignmentId = (assignRes.body as { items: Array<{ id: string }> }).items[0]!.id;

    const startRes = await studentClient
      .post(`/api/v1/assignments/${assignmentId}/submissions/start`)
      .expect(200);
    const submissionId = (startRes.body as { submission: { id: string } }).submission.id;

    // Autosave with 201 entries -> 400 (ArrayMaxSize(200))
    const oversizedAnswers = Array.from({ length: 201 }, () => ({
      questionId: questionIds.single,
      answerPayload: { selectedOptionIds: ['a'] },
    }));
    await studentClient
      .patch(`/api/v1/assignments/${assignmentId}/submissions/autosave`)
      .send({ elapsedSeconds: 10, remainingSeconds: 1790, answers: oversizedAnswers })
      .expect(400);

    // Autosave with duplicate questionId -> 400
    await studentClient
      .patch(`/api/v1/assignments/${assignmentId}/submissions/autosave`)
      .send({
        elapsedSeconds: 12,
        remainingSeconds: 1788,
        answers: [
          { questionId: questionIds.single, answerPayload: { selectedOptionIds: ['a'] } },
          { questionId: questionIds.single, answerPayload: { selectedOptionIds: ['b'] } },
        ],
      })
      .expect(400);

    // Submit so teacher reopen can be tested with offset-less newDueAt -> 400
    await studentClient
      .post(`/api/v1/assignments/${assignmentId}/submissions/submit`)
      .send({ elapsedSeconds: 20, remainingSeconds: 1780 })
      .expect(200);

    await teacherClient
      .post(`/api/v1/submissions/${submissionId}/reopen`)
      .send({ reason: 'Thiếu múi giờ', newDueAt: '2027-12-01T23:59:00' })
      .expect(400);

    // Tracker pagination: page=1&limit=1 returns 1 student row with total >= 2 and accurate stats
    const page1Res = await teacherClient
      .get(`/api/v1/assignments/${assignmentId}/submissions?page=1&limit=1`)
      .expect(200);
    const page1 = page1Res.body as {
      students: Array<{ studentId: string }>;
      page: number;
      limit: number;
      total: number;
      assignment: { stats: { totalStudents: number } };
    };
    expect(page1.students).toHaveLength(1);
    expect(page1.page).toBe(1);
    expect(page1.limit).toBe(1);
    expect(page1.total).toBeGreaterThanOrEqual(2);
    expect(page1.assignment.stats.totalStudents).toBe(page1.total);

    const page2Res = await teacherClient
      .get(`/api/v1/assignments/${assignmentId}/submissions?page=2&limit=1`)
      .expect(200);
    const page2 = page2Res.body as {
      students: Array<{ studentId: string }>;
      page: number;
      limit: number;
      total: number;
    };
    expect(page2.students).toHaveLength(1);
    expect(page2.page).toBe(2);
    expect(page2.students[0]!.studentId).not.toBe(page1.students[0]!.studentId);
  });
});
