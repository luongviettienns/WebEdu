import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import {
  GradingStatus,
  QuestionType,
  Role,
  SubmissionStatus,
  UserStatus,
} from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import type { AuthenticatedUser } from '../../../common/auth/auth.types.js';
import { AssignmentAccessPolicy } from '../../assignments/policies/assignment-access.policy.js';
import type { AiGradingConfigService } from '../../system-settings/services/ai-grading-config.service.js';
import {
  buildZeroPiiEssayGradingMessages,
  callAiProviderForEssayDraft,
  MAX_AI_FEEDBACK_LENGTH,
  parseAndClampAiGradingJson,
  runInBoundedChunks,
} from '../adapters/ai-provider.adapter.js';
import {
  sanitizeAndVerifyEssayDraftInput,
  ZeroPiiManualGradingRequiredException,
} from '../policies/ai-pii-guard.policy.js';
import { AiEssayGradingService } from './ai-essay-grading.service.js';

function makeTeacher(id = 'teacher-1'): AuthenticatedUser {
  return {
    id,
    email: 'gv@webedu.vn',
    phone: '0901000001',
    fullName: 'Cô Lan',
    roles: [Role.TEACHER],
    effectiveRole: Role.TEACHER,
    status: UserStatus.ACTIVE,
    tokenVersion: 0,
  };
}

describe('AiEssayGradingService & Multi-Provider Adapter (Slice 7.2 — FUNC-057, DEC-036)', () => {
  it('parses fenced JSON responses and validates numeric suggestedPoints + non-empty string feedback before clamping to [0, maxPoints]', () => {
    expect(
      parseAndClampAiGradingJson('```json\n{"suggestedPoints": 99, "feedback": "Tốt"}\n```', 5),
    ).toEqual({ suggestedPoints: 5, feedback: 'Tốt' });

    expect(
      parseAndClampAiGradingJson('{"suggestedPoints": -3, "feedback": "Sai"}', 5),
    ).toEqual({ suggestedPoints: 0, feedback: 'Sai' });

    expect(
      parseAndClampAiGradingJson('{"suggestedPoints": 2.38, "feedback": "Khá"}', 5),
    ).toEqual({ suggestedPoints: 2.5, feedback: 'Khá' });

    expect(
      parseAndClampAiGradingJson('{"suggestedPoints": 0.9, "feedback": "Đủ ý"}', 0.9),
    ).toEqual({ suggestedPoints: 0.75, feedback: 'Đủ ý' });

    expect(() =>
      parseAndClampAiGradingJson('{"suggestedPoints": null, "feedback": "OK"}', 5),
    ).toThrow(BadGatewayException);
    expect(() =>
      parseAndClampAiGradingJson('{"suggestedPoints": 3, "feedback": "   "}', 5),
    ).toThrow(BadGatewayException);
    expect(() => parseAndClampAiGradingJson('not json', 5)).toThrow(BadGatewayException);
  });

  it('calls OPENAI, GEMINI, and CUSTOM providers cleanly and handles timeouts', async () => {
    const openaiFetch = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            choices: [{ message: { content: '{"suggestedPoints": 4.25, "feedback": "Đúng ngữ pháp"}' } }],
          }),
          { status: 200 },
        ),
    );
    const oaRes = await callAiProviderForEssayDraft(
      {
        enabled: true,
        provider: 'OPENAI',
        baseUrl: 'https://api.openai.com/v1',
        model: 'gpt-6-luna',
        apiKey: 'sk-12345678',
        timeoutMs: 10_000,
      },
      {
        prompt: 'Viết câu tiếng Trung nói về sở thích đọc sách.',
        maxPoints: 5,
        sampleAnswer: '我喜欢看书。',
        rubric: 'Đủ ý',
        studentAnswer: '我非常喜欢看汉语书。',
      },
      openaiFetch as unknown as typeof fetch,
    );
    expect(oaRes).toEqual({ suggestedPoints: 4.25, feedback: 'Đúng ngữ pháp' });

    const geminiFetch = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            candidates: [
              { content: { parts: [
                { thought: true, text: '{"suggestedPoints": 1, "feedback": "Internal reasoning"}' },
                { text: '{"suggestedPoints": 3.5,' },
                { text: ' "feedback": "Khá tốt"}' },
              ] } },
            ],
          }),
          { status: 200 },
        ),
    );
    const gmRes = await callAiProviderForEssayDraft(
      {
        enabled: true,
        provider: 'GEMINI',
        baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
        model: 'gemini-3.5-flash-lite',
        apiKey: 'gemini-secret',
        timeoutMs: 10_000,
      },
      {
        prompt: 'Dịch câu cảm ơn thầy giáo.',
        maxPoints: 4,
        sampleAnswer: null,
        rubric: null,
        studentAnswer: '谢谢老师',
      },
      geminiFetch as unknown as typeof fetch,
    );
    expect(gmRes).toEqual({ suggestedPoints: 3.5, feedback: 'Khá tốt' });

    const networkFailFetch = vi.fn(async () => {
      throw new Error('ECONNRESET');
    });
    await expect(
      callAiProviderForEssayDraft(
        {
          enabled: true,
          provider: 'CUSTOM',
          baseUrl: 'https://llm.partner.example/v1',
          model: 'qwen',
          apiKey: 'key-1234',
          timeoutMs: 5_000,
        },
        {
          prompt: 'Đề bài đọc hiểu',
          maxPoints: 5,
          sampleAnswer: null,
          rubric: null,
          studentAnswer: 'Tôi rất thích học tiếng Trung.',
        },
        networkFailFetch as unknown as typeof fetch,
      ),
    ).rejects.toThrow(BadGatewayException);
  });

  function setupService(runtimeConfig?: Partial<{ enabled: boolean; apiKey: string; timeoutMs: number }>) {
    const tx = {
      $queryRaw: vi.fn(async () => []),
      class: {
        findUnique: vi.fn(
          async (args?: unknown): Promise<Record<string, unknown> | null> =>
            (prisma.class.findUnique as (a?: unknown) => Promise<Record<string, unknown> | null>)(args),
        ),
      },
      submissionAnswer: {
        upsert: vi.fn(async () => ({})),
        findMany: vi.fn(async () => []),
      },
      submission: {
        findUnique: vi.fn(async (): Promise<{ id: string; status: SubmissionStatus }> => ({
          id: 'sub-1',
          status: SubmissionStatus.SUBMITTED_WAITING,
        })),
        update: vi.fn(async () => ({})),
      },
      systemAuditLog: { create: vi.fn(async () => ({})) },
    };
    const prisma = {
      $transaction: vi.fn(async (cb: (client: typeof tx) => Promise<unknown>) => cb(tx)),
      class: {
        findUnique: vi.fn(async () => ({
          id: 'cls-1',
          code: 'HSK1-A',
          teacherId: 'teacher-1',
          courseId: 'course-1',
          status: 'ACTIVE',
          course: { name: 'HSK 1' },
        })),
      },
      classAssignment: { findUnique: vi.fn() },
      submission: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
        update: vi.fn(async () => ({})),
      },
    };
    const aiConfigService = {
      getResolvedAiRuntimeConfig: vi.fn(async () => ({
        enabled: runtimeConfig?.enabled ?? true,
        provider: 'OPENAI' as const,
        baseUrl: 'https://api.openai.com/v1',
        model: 'gpt-6-luna',
        apiKey: runtimeConfig?.apiKey ?? 'sk-test-key-1234',
        timeoutMs: runtimeConfig?.timeoutMs ?? 10_000,
      })),
    } as unknown as AiGradingConfigService;

    const service = new AiEssayGradingService(
      prisma as never,
      new AssignmentAccessPolicy(),
      aiConfigService,
    );
    return { prisma, tx, service };
  }

  it('requires teacher-reviewed Zero-PII payload, handles empty essays without calling provider, and saves draft without writing earnedPoints/totalScore', async () => {
    const { prisma, tx, service } = setupService();
    const setupSubmission = () => ({
      id: 'sub-1',
      status: SubmissionStatus.SUBMITTED_WAITING,
      gradingStatus: GradingStatus.NONE,
      student: { fullName: 'Nguyễn Minh An' },
      classAssignment: {
        classId: 'cls-1',
        assessment: {
          questions: [
            {
              id: 'q-essay-1',
              prompt: 'Viết đoạn văn ngắn về học tiếng Trung (email mẫu demo@example.com)',
              points: 4,
              payload: { sampleAnswer: '我喜欢学汉语。', rubric: 'Đúng chủ đề, SĐT liên hệ 0901234567' },
            },
            {
              id: 'q-essay-empty',
              prompt: 'Câu bỏ trống',
              points: 2,
              payload: {},
            },
          ],
        },
      },
      answers: [
        { questionId: 'q-essay-1', answerPayload: { text: '我爸爸叫王建国，我很喜欢学习汉语，liên hệ sv@webedu.vn' } },
        { questionId: 'q-essay-empty', answerPayload: { text: '   ' } },
      ],
    });

    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            choices: [
              { message: { content: '{"suggestedPoints": 3.7, "feedback": "Câu tự nhiên"}' } },
            ],
          }),
          { status: 200 },
        ),
    );

    // Unreviewed call rejected without calling AI provider
    prisma.submission.findUnique.mockResolvedValueOnce(setupSubmission());
    await expect(
      service.suggestEssayGradesForSubmission(
        'sub-1',
        makeTeacher(),
        undefined,
        fetchMock as unknown as typeof fetch,
      ),
    ).rejects.toThrow(BadRequestException);
    expect(fetchMock).not.toHaveBeenCalled();

    // Unsanitized relative name ("我爸爸叫王建国") inside reviewedInput also rejected before calling provider
    prisma.submission.findUnique.mockResolvedValueOnce(setupSubmission());
    await expect(
      service.suggestEssayGradesForSubmission(
        'sub-1',
        makeTeacher(),
        {
          questionId: 'q-essay-1',
          reviewedInput: {
            prompt: 'Viết đoạn văn ngắn về học tiếng Trung',
            sampleAnswer: '我喜欢学汉语。',
            rubric: 'Đúng chủ đề',
            studentAnswer: '我爸爸叫王建国，我很喜欢学习汉语。',
          },
        },
        fetchMock as unknown as typeof fetch,
      ),
    ).rejects.toThrow(ZeroPiiManualGradingRequiredException);
    expect(fetchMock).not.toHaveBeenCalled();

    // Teacher-reviewed + scrubbed input succeeds and never leaks raw PII
    prisma.submission.findUnique.mockResolvedValueOnce(setupSubmission());
    const res = await service.suggestEssayGradesForSubmission(
      'sub-1',
      makeTeacher(),
      {
        questionId: 'q-essay-1',
        reviewedInput: {
          prompt: 'Viết đoạn văn ngắn về học tiếng Trung (email mẫu [REDACTED_EMAIL])',
          sampleAnswer: '我喜欢学汉语。',
          rubric: 'Đúng chủ đề, SĐT liên hệ [REDACTED_PHONE]',
          studentAnswer: '我很喜欢学习汉语, liên hệ [REDACTED_EMAIL]',
        },
      },
      fetchMock as unknown as typeof fetch,
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const reqInit = (fetchMock.mock.calls[0] as unknown as [string, { body?: string }])[1];
    const reqBody = reqInit.body ?? '';
    expect(reqBody).toContain('[REDACTED_EMAIL]');
    expect(reqBody).toContain('[REDACTED_PHONE]');
    expect(reqBody).not.toContain('demo@example.com');
    expect(reqBody).not.toContain('0901234567');
    expect(reqBody).not.toContain('sv@webedu.vn');
    expect(reqBody).not.toContain('gv@webedu.vn');
    expect(reqBody).not.toContain('Nguyễn Minh An');
    expect(reqBody).not.toContain('王建国');
    expect(reqBody).not.toContain('sub-1');

    // Never writes PENDING_AI directly before calling provider
    expect(prisma.submission.update).not.toHaveBeenCalled();

    expect(res.gradingStatus).toBe(GradingStatus.AI_DRAFT_READY);
    expect(res.suggestions).toEqual([
      {
        questionId: 'q-essay-1',
        maxPoints: 4,
        aiSuggestedPoints: 3.75,
        aiFeedback: 'Câu tự nhiên',
        skippedEmpty: false,
      },
    ]);

    // Empty essay returns 0 without requiring AI call
    prisma.submission.findUnique.mockResolvedValueOnce(setupSubmission());
    const emptyRes = await service.suggestEssayGradesForSubmission(
      'sub-1',
      makeTeacher(),
      { questionId: 'q-essay-empty' },
      fetchMock as unknown as typeof fetch,
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(emptyRes.suggestions).toEqual([
      {
        questionId: 'q-essay-empty',
        maxPoints: 2,
        aiSuggestedPoints: 0,
        aiFeedback: 'Học viên để trống câu tự luận này.',
        skippedEmpty: true,
      },
    ]);

    for (const call of tx.submissionAnswer.upsert.mock.calls) {
      const arg = (call as unknown as [{ update: Record<string, unknown> }])[0];
      expect('earnedPoints' in arg.update).toBe(false);
    }
    expect(tx.submission.update).toHaveBeenCalledWith({
      where: { id: 'sub-1' },
      data: { gradingStatus: GradingStatus.AI_DRAFT_READY },
    });
  });

  it('Issue #6: falls back to manual grading without calling provider when unverifiable PII appears in prompt, sampleAnswer, rubric, or studentAnswer', async () => {
    const providerFetch = vi.fn();
    const cases = [
      { field: 'prompt', input: { prompt: 'Hãy viết đoạn văn tự giới thiệu bản thân', maxPoints: 5, sampleAnswer: null, rubric: null, studentAnswer: '我每天看书。' } },
      { field: 'sampleAnswer', input: { prompt: 'Viết câu tiếng Trung', maxPoints: 5, sampleAnswer: '我叫王明。', rubric: null, studentAnswer: '我学习汉语。' } },
      { field: 'rubric', input: { prompt: 'Viết câu', maxPoints: 5, sampleAnswer: null, rubric: 'Đúng địa chỉ nhà: số nhà 12 ngõ 4 Hà Nội', studentAnswer: '我喜欢喝茶。' } },
      { field: 'studentAnswer', input: { prompt: 'Viết câu ngắn', maxPoints: 5, sampleAnswer: null, rubric: null, studentAnswer: 'Tôi tên là Trần Văn Nam, rất thích học tiếng Trung.' } },
      { field: 'studentAnswer_father_cn', input: { prompt: 'Viết câu ngắn', maxPoints: 5, sampleAnswer: null, rubric: null, studentAnswer: '我爸爸叫王建国，是老师。' } },
      { field: 'studentAnswer_father_vi', input: { prompt: 'Viết câu ngắn', maxPoints: 5, sampleAnswer: null, rubric: null, studentAnswer: 'Bố em tên là Trần Văn Bình, làm kỹ sư.' } },
    ];

    for (const testCase of cases) {
      await expect(
        callAiProviderForEssayDraft(
          {
            enabled: true,
            provider: 'OPENAI',
            baseUrl: 'https://api.openai.com/v1',
            model: 'gpt-6-luna',
            apiKey: 'sk-test',
            timeoutMs: 10_000,
          },
          testCase.input,
          { fetchImpl: providerFetch as unknown as typeof fetch, forbiddenNames: ['Trần Văn Nam'] },
        ),
        `Expected Zero-PII fallback for ${testCase.field}`,
      ).rejects.toThrow(ZeroPiiManualGradingRequiredException);
    }
    expect(providerFetch).not.toHaveBeenCalled();
  });

  it('Issue #10: does not write PENDING_AI on failure, blocks GRADED/RETURNED (409) before and after AI call under FOR UPDATE lock', async () => {
    const { prisma, tx, service } = setupService();

    // 1. GRADED submission rejected before calling AI (409)
    prisma.submission.findUnique.mockResolvedValueOnce({
      id: 'sub-graded',
      status: SubmissionStatus.GRADED,
      gradingStatus: GradingStatus.GRADED,
      student: { fullName: 'Học viên B' },
      classAssignment: {
        classId: 'cls-1',
        assessment: { questions: [{ id: 'q-1', prompt: 'Viết câu', points: 5, payload: {} }] },
      },
      answers: [{ questionId: 'q-1', answerPayload: { text: '我喜欢学习。' } }],
    });
    const fetchBefore = vi.fn();
    await expect(
      service.suggestEssayGradesForSubmission(
        'sub-graded',
        makeTeacher(),
        undefined,
        fetchBefore as unknown as typeof fetch,
      ),
    ).rejects.toThrow(ConflictException);
    expect(fetchBefore).not.toHaveBeenCalled();

    // 2. Concurrent confirm moves submission to GRADED while AI call is in flight -> post-lock 409 with zero writes
    prisma.submission.findUnique.mockResolvedValueOnce({
      id: 'sub-race',
      status: SubmissionStatus.SUBMITTED_WAITING,
      gradingStatus: GradingStatus.NONE,
      student: { fullName: 'Học viên C' },
      classAssignment: {
        classId: 'cls-1',
        assessment: { questions: [{ id: 'q-1', prompt: 'Viết câu', points: 5, payload: {} }] },
      },
      answers: [{ questionId: 'q-1', answerPayload: { text: '我喜欢喝茶。' } }],
    });
    tx.submission.findUnique.mockResolvedValueOnce({ id: 'sub-race', status: SubmissionStatus.GRADED });
    const okFetch = vi.fn(
      async () =>
        new Response(
          JSON.stringify({ choices: [{ message: { content: '{"suggestedPoints": 4, "feedback": "Tốt"}' } }] }),
          { status: 200 },
        ),
    );
    await expect(
      service.suggestEssayGradesForSubmission(
        'sub-race',
        makeTeacher(),
        {
          questionId: 'q-1',
          reviewedInput: { prompt: 'Viết câu', sampleAnswer: '', rubric: '', studentAnswer: '我喜欢喝茶。' },
        },
        okFetch as unknown as typeof fetch,
      ),
    ).rejects.toThrow(ConflictException);
    expect(tx.submissionAnswer.upsert).not.toHaveBeenCalled();
    expect(tx.submission.update).not.toHaveBeenCalled();

    // 3. Provider failure leaves submission.gradingStatus untouched (no PENDING_AI written)
    prisma.submission.findUnique.mockResolvedValueOnce({
      id: 'sub-1',
      status: SubmissionStatus.SUBMITTED_WAITING,
      gradingStatus: GradingStatus.NONE,
      student: { fullName: 'Học viên D' },
      classAssignment: {
        classId: 'cls-1',
        assessment: { questions: [{ id: 'q-1', prompt: 'Tự luận', points: 5, payload: { type: QuestionType.ESSAY } }] },
      },
      answers: [{ questionId: 'q-1', answerPayload: { text: '我每天学汉语。' } }],
    });
    const failingFetch = vi.fn(async () => new Response('Server Error', { status: 500 }));
    await expect(
      service.suggestEssayGradesForSubmission(
        'sub-1',
        makeTeacher(),
        {
          questionId: 'q-1',
          reviewedInput: { prompt: 'Tự luận', sampleAnswer: '', rubric: '', studentAnswer: '我每天学汉语。' },
        },
        failingFetch as unknown as typeof fetch,
      ),
    ).rejects.toThrow(BadGatewayException);
    expect(prisma.submission.update).not.toHaveBeenCalled();

    // Unauthorized teacher rejected
    prisma.submission.findUnique.mockResolvedValueOnce({
      id: 'sub-1',
      status: SubmissionStatus.SUBMITTED_WAITING,
      gradingStatus: GradingStatus.NONE,
      student: { fullName: 'Học viên D' },
      classAssignment: { classId: 'cls-1', assessment: { questions: [] } },
      answers: [],
    });
    await expect(
      service.suggestEssayGradesForSubmission('sub-1', makeTeacher('other-teacher')),
    ).rejects.toThrow(ForbiddenException);

    // Disabled AI config rejected
    const { prisma: disabledPrisma, service: disabledService } = setupService({ enabled: false });
    disabledPrisma.submission.findUnique.mockResolvedValueOnce({
      id: 'sub-1',
      status: SubmissionStatus.SUBMITTED_WAITING,
      gradingStatus: GradingStatus.NONE,
      student: { fullName: 'Học viên D' },
      classAssignment: {
        classId: 'cls-1',
        assessment: { questions: [{ id: 'q-1', prompt: 'Tự luận', points: 5, payload: {} }] },
      },
      answers: [],
    });
    await expect(
      disabledService.suggestEssayGradesForSubmission('sub-1', makeTeacher()),
    ).rejects.toThrow(BadRequestException);
  });

  it('Issue #11: suggests essay grades in batch for reviewed submissions and routes unreviewed submissions to manual grading', async () => {
    const { prisma, tx, service } = setupService();
    prisma.classAssignment.findUnique.mockResolvedValueOnce({
      id: 'assign-1',
      classId: 'cls-1',
      assessment: { questions: [{ id: 'q-1' }] },
    });
    prisma.submission.findMany.mockResolvedValueOnce([{ id: 'sub-ok' }, { id: 'sub-unreviewed' }]);
    prisma.submission.findUnique.mockResolvedValueOnce({
      id: 'sub-ok',
      status: SubmissionStatus.SUBMITTED_WAITING,
      gradingStatus: GradingStatus.NONE,
      student: { fullName: 'Học viên OK' },
      classAssignment: {
        classId: 'cls-1',
        assessment: { questions: [{ id: 'q-1', prompt: 'Viết câu về sách', points: 5, payload: {} }] },
      },
      answers: [{ questionId: 'q-1', answerPayload: { text: '我喜欢看书。' } }],
    });
    tx.submission.findUnique.mockResolvedValueOnce({ id: 'sub-ok', status: SubmissionStatus.SUBMITTED_WAITING });

    const okFetch = vi.fn(
      async () =>
        new Response(
          JSON.stringify({ choices: [{ message: { content: '{"suggestedPoints": 4.5, "feedback": "Tốt"}' } }] }),
          { status: 200 },
        ),
    );
    const batchRes = await service.suggestEssayGradesForAssignmentBatch(
      'assign-1',
      {
        submissionIds: ['sub-ok', 'sub-unreviewed', 'sub-foreign'],
        reviews: [
          {
            submissionId: 'sub-ok',
            questionId: 'q-1',
            reviewedInput: { prompt: 'Viết câu về sách', sampleAnswer: '', rubric: '', studentAnswer: '我喜欢看书。' },
          },
        ],
      },
      makeTeacher(),
      okFetch as unknown as typeof fetch,
    );
    expect(batchRes).toEqual({
      assignmentId: 'assign-1',
      requestedCount: 3,
      succeededCount: 1,
      failedCount: 2,
      results: [
        {
          submissionId: 'sub-ok',
          ok: true,
          gradingStatus: GradingStatus.AI_DRAFT_READY,
          suggestedCount: 1,
        },
        {
          submissionId: 'sub-unreviewed',
          ok: false,
          error: 'Cần duyệt nội dung câu tự luận hoặc chấm tay',
        },
        {
          submissionId: 'sub-foreign',
          ok: false,
          error: 'Bài nộp không thuộc bài giao này hoặc không tồn tại',
        },
      ],
    });
  });

  it('suggests only missing questions when selecting a reviewed submission for an implicit batch', async () => {
    const { prisma, tx, service } = setupService();
    const questions = ['q-1', 'q-2'].map((id) => ({
      id, prompt: 'Viết câu về sách', points: 5, payload: {},
    }));
    prisma.classAssignment.findUnique.mockResolvedValueOnce({
      id: 'assign-1', classId: 'cls-1', assessment: { questions },
    });
    prisma.submission.findMany.mockResolvedValueOnce([{ id: 'sub-1' }]);
    prisma.submission.findUnique.mockResolvedValueOnce({
      id: 'sub-1',
      status: SubmissionStatus.SUBMITTED_WAITING,
      student: { fullName: 'Học viên OK' },
      classAssignment: { classId: 'cls-1', assessment: { questions } },
      answers: [
        { questionId: 'q-1', answerPayload: { text: '我读书。' }, aiSuggestedPoints: 0 },
        { questionId: 'q-2', answerPayload: { text: '我喜欢看书。' }, aiSuggestedPoints: null },
      ],
    });
    const fetchMock = vi.fn(async () => Response.json({
      choices: [{ message: { content: '{"suggestedPoints": 4.5, "feedback": "Tốt"}' } }],
    }));

    const result = await service.suggestEssayGradesForAssignmentBatch(
      'assign-1',
      {
        reviews: [
          {
            submissionId: 'sub-1',
            questionId: 'q-2',
            reviewedInput: { prompt: 'Viết câu về sách', sampleAnswer: '', rubric: '', studentAnswer: '我喜欢看书。' },
          },
        ],
      },
      makeTeacher(),
      fetchMock,
    );

    expect(result.results).toEqual([{
      submissionId: 'sub-1', ok: true, gradingStatus: GradingStatus.AI_DRAFT_READY, suggestedCount: 1,
    }]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(tx.submissionAnswer.upsert).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
      where: { submissionId_questionId: { submissionId: 'sub-1', questionId: 'q-2' } },
    }));
  });

  it('shares the provider deadline across a batch and reports later submissions for retry', async () => {
    const { prisma, tx, service } = setupService({ timeoutMs: 25_000 });
    const submissionIds = ['sub-1', 'sub-2', 'sub-3'];
    const question = { id: 'q-1', prompt: 'Viết câu về sách', points: 5, payload: {} };
    prisma.classAssignment.findUnique.mockResolvedValueOnce({
      id: 'assign-1', classId: 'cls-1', assessment: { questions: [question] },
    });
    prisma.submission.findMany.mockResolvedValueOnce(submissionIds.map((id) => ({ id })));
    for (const id of submissionIds) {
      prisma.submission.findUnique.mockResolvedValueOnce({
        id,
        status: SubmissionStatus.SUBMITTED_WAITING,
        classAssignment: { classId: 'cls-1', assessment: { questions: [question] } },
        answers: [{ questionId: 'q-1', answerPayload: { text: '我喜欢看书。' } }],
      });
    }
    let now = 0;
    const clock = vi.spyOn(Date, 'now').mockImplementation(() => now);
    const timeouts = vi.spyOn(AbortSignal, 'timeout');
    const fetchMock = vi.fn(async () => {
      now = now === 0 ? 18_000 : 25_000;
      return Response.json({ choices: [{ message: { content: '{"suggestedPoints": 4, "feedback": "Tốt"}' } }] });
    });

    try {
      const batch = await service.suggestEssayGradesForAssignmentBatch(
        'assign-1',
        {
          submissionIds,
          reviews: submissionIds.map((submissionId) => ({
            submissionId,
            questionId: 'q-1',
            reviewedInput: { prompt: 'Viết câu về sách', sampleAnswer: '', rubric: '', studentAnswer: '我喜欢看书。' },
          })),
        },
        makeTeacher(),
        fetchMock,
      );
      expect(batch).toMatchObject({ requestedCount: 3, succeededCount: 2, failedCount: 1 });
      expect(batch.results[2]).toMatchObject({ submissionId: 'sub-3', ok: false, error: expect.stringContaining('thử lại') });
      expect(tx.submissionAnswer.upsert).toHaveBeenCalledTimes(2);
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(timeouts.mock.calls).toEqual([[25_000], [7_000]]);
    } finally {
      clock.mockRestore();
      timeouts.mockRestore();
    }
  });

  it('keeps AI scores at or below the stored maximum for legacy off-step question points', () => {
    const response = '{"suggestedPoints": 1, "feedback": "Tốt"}';
    expect(parseAndClampAiGradingJson(response, 0.4).suggestedPoints).toBe(0.25);
    expect(parseAndClampAiGradingJson(response, 0.1).suggestedPoints).toBe(0);
  });

  it('requires manual grading for a Chinese date of birth or a known name inside a sentence', () => {
    const input = {
      prompt: 'Viết đoạn văn', maxPoints: 5, sampleAnswer: null, rubric: null,
    };
    expect(() => sanitizeAndVerifyEssayDraftInput({
      ...input, studentAnswer: '我的生日是2008年5月17日。',
    })).toThrow(ZeroPiiManualGradingRequiredException);
    expect(() => sanitizeAndVerifyEssayDraftInput({
      ...input, studentAnswer: '我和李华去上学。',
    }, ['李华'])).toThrow(ZeroPiiManualGradingRequiredException);
  });

  it('Issue #1 & #12: blocks Vietnamese name/address PII, scrubs Unicode emails, and enforces feedback length bound', () => {
    expect(() =>
      sanitizeAndVerifyEssayDraftInput({
        prompt: 'Viết đoạn văn',
        maxPoints: 5,
        sampleAnswer: null,
        rubric: null,
        studentAnswer: 'Tên em là Minh. Em thích học tiếng Trung.',
      }),
    ).toThrow(ZeroPiiManualGradingRequiredException);

    expect(() =>
      sanitizeAndVerifyEssayDraftInput({
        prompt: 'Viết đoạn văn',
        maxPoints: 5,
        sampleAnswer: null,
        rubric: null,
        studentAnswer: 'Nhà em ở số 12 đường Nguyễn Trãi, Hà Nội.',
      }),
    ).toThrow(ZeroPiiManualGradingRequiredException);

    const scrubbed = sanitizeAndVerifyEssayDraftInput({
      prompt: 'Viết đoạn văn',
      maxPoints: 5,
      sampleAnswer: null,
      rubric: null,
      studentAnswer: 'Liên hệ minh@trường.vn nếu cần.',
    });
    expect(scrubbed.studentAnswer).toBe('Liên hệ [REDACTED_EMAIL] nếu cần.');

    expect(() =>
      parseAndClampAiGradingJson(
        JSON.stringify({ suggestedPoints: 2, feedback: 'x'.repeat(MAX_AI_FEEDBACK_LENGTH + 1) }),
        5,
      ),
    ).toThrow(BadGatewayException);
  });

  it('keeps systemPrompt invariant for prompt caching, includes courseLevel in userPayload, and runs bounded chunks in order', async () => {
    const m1 = buildZeroPiiEssayGradingMessages({
      prompt: 'Câu 1',
      maxPoints: 2,
      courseLevel: 'HSK1',
      sampleAnswer: '我喜欢看书。',
      rubric: null,
      studentAnswer: '我喜欢看书。',
    });
    const m2 = buildZeroPiiEssayGradingMessages({
      prompt: 'Câu 2',
      maxPoints: 5,
      courseLevel: 'HSK4',
      sampleAnswer: null,
      rubric: 'Đủ cấu trúc 把',
      studentAnswer: '我把作业做完了。',
    });

    expect(m1.systemPrompt).toBe(m2.systemPrompt);
    expect(JSON.parse(m1.userPrompt)).toMatchObject({ courseLevel: 'HSK1', maxPoints: 2 });
    expect(JSON.parse(m2.userPrompt)).toMatchObject({ courseLevel: 'HSK4', maxPoints: 5 });

    let active = 0;
    let maxActive = 0;
    const out = await runInBoundedChunks([1, 2, 3, 4, 5, 6], 2, async (n) => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise((r) => setTimeout(r, 5));
      active -= 1;
      return n * 10;
    });
    expect(maxActive).toBeLessThanOrEqual(2);
    expect(out).toEqual([10, 20, 30, 40, 50, 60]);
  });
});
