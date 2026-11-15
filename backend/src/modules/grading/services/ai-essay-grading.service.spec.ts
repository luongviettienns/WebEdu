import { BadGatewayException, BadRequestException, ForbiddenException } from '@nestjs/common';
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
  callAiProviderForEssayDraft,
  parseAndClampAiGradingJson,
} from '../adapters/ai-provider.adapter.js';
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
  it('parses fenced JSON responses and clamps/rounds suggestedPoints to [0, maxPoints] in 0.25 steps', () => {
    expect(
      parseAndClampAiGradingJson('```json\n{"suggestedPoints": 99, "feedback": "Tốt"}\n```', 5),
    ).toEqual({ suggestedPoints: 5, feedback: 'Tốt' });

    expect(
      parseAndClampAiGradingJson('{"suggestedPoints": -3, "feedback": "Sai"}', 5),
    ).toEqual({ suggestedPoints: 0, feedback: 'Sai' });

    expect(
      parseAndClampAiGradingJson('{"suggestedPoints": 2.38, "feedback": "Khá"}', 5),
    ).toEqual({ suggestedPoints: 2.5, feedback: 'Khá' });

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
        model: 'gpt-4o-mini',
        apiKey: 'sk-12345678',
        timeoutMs: 10_000,
      },
      {
        prompt: 'Giới thiệu bản thân',
        maxPoints: 5,
        sampleAnswer: '我叫安。',
        rubric: 'Đủ câu chào',
        studentAnswer: '我叫明。',
      },
      openaiFetch as unknown as typeof fetch,
    );
    expect(oaRes).toEqual({ suggestedPoints: 4.25, feedback: 'Đúng ngữ pháp' });

    const geminiFetch = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            candidates: [
              { content: { parts: [{ text: '{"suggestedPoints": 3.5, "feedback": "Khá tốt"}' }] } },
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
        model: 'gemini-2.5-flash',
        apiKey: 'gemini-secret',
        timeoutMs: 10_000,
      },
      {
        prompt: 'Dịch câu',
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
          prompt: 'Đề bài',
          maxPoints: 5,
          sampleAnswer: null,
          rubric: null,
          studentAnswer: 'Bài làm',
        },
        networkFailFetch as unknown as typeof fetch,
      ),
    ).rejects.toThrow(BadGatewayException);
  });

  function setupService(runtimeConfig?: Partial<{ enabled: boolean; apiKey: string }>) {
    const tx = {
      submissionAnswer: { upsert: vi.fn(async () => ({})) },
      submission: { update: vi.fn(async () => ({})) },
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
      submission: {
        findUnique: vi.fn(),
        update: vi.fn(async () => ({})),
      },
    };
    const aiConfigService = {
      getResolvedAiRuntimeConfig: vi.fn(async () => ({
        enabled: runtimeConfig?.enabled ?? true,
        provider: 'OPENAI' as const,
        baseUrl: 'https://api.openai.com/v1',
        model: 'gpt-4o-mini',
        apiKey: runtimeConfig?.apiKey ?? 'sk-test-key-1234',
        timeoutMs: 10_000,
      })),
    } as unknown as AiGradingConfigService;

    const service = new AiEssayGradingService(
      prisma as never,
      new AssignmentAccessPolicy(),
      aiConfigService,
    );
    return { prisma, tx, service };
  }

  it('sends strictly Zero-PII payload, handles empty essays without calling provider, and saves draft without writing earnedPoints/totalScore', async () => {
    const { prisma, tx, service } = setupService();
    prisma.submission.findUnique.mockResolvedValueOnce({
      id: 'sub-1',
      status: SubmissionStatus.SUBMITTED_WAITING,
      gradingStatus: GradingStatus.NONE,
      classAssignment: {
        classId: 'cls-1',
        assessment: {
          questions: [
            {
              id: 'q-essay-1',
              prompt: 'Viết đoạn văn ngắn',
              points: 4,
              payload: { sampleAnswer: '我喜欢学汉语。', rubric: 'Đúng chủ đề' },
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
        { questionId: 'q-essay-1', answerPayload: { text: '我很喜欢学习汉语。' } },
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

    const res = await service.suggestEssayGradesForSubmission(
      'sub-1',
      makeTeacher(),
      undefined,
      fetchMock as unknown as typeof fetch,
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const reqInit = (fetchMock.mock.calls[0] as unknown as [string, { body?: string }])[1];
    const reqBody = reqInit.body ?? '';
    expect(reqBody).toContain('Viết đoạn văn ngắn');
    expect(reqBody).toContain('我很喜欢学习汉语。');
    expect(reqBody).not.toContain('gv@webedu.vn');
    expect(reqBody).not.toContain('teacher-1');
    expect(reqBody).not.toContain('sub-1');
    expect(reqBody).not.toContain('cls-1');

    expect(res.gradingStatus).toBe(GradingStatus.AI_DRAFT_READY);
    expect(res.suggestions).toEqual([
      {
        questionId: 'q-essay-1',
        maxPoints: 4,
        aiSuggestedPoints: 3.75,
        aiFeedback: 'Câu tự nhiên',
        skippedEmpty: false,
      },
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

  it('restores previous gradingStatus when AI provider fails and enforces RBAC + config guards', async () => {
    const { prisma, service } = setupService();
    prisma.submission.findUnique.mockResolvedValueOnce({
      id: 'sub-1',
      status: SubmissionStatus.SUBMITTED_WAITING,
      gradingStatus: GradingStatus.NONE,
      classAssignment: {
        classId: 'cls-1',
        assessment: {
          questions: [
            { id: 'q-1', prompt: 'Tự luận', points: 5, payload: { type: QuestionType.ESSAY } },
          ],
        },
      },
      answers: [{ questionId: 'q-1', answerPayload: { text: 'Trả lời' } }],
    });

    const failingFetch = vi.fn(async () => new Response('Server Error', { status: 500 }));
    await expect(
      service.suggestEssayGradesForSubmission(
        'sub-1',
        makeTeacher(),
        undefined,
        failingFetch as unknown as typeof fetch,
      ),
    ).rejects.toThrow(BadGatewayException);

    // First call sets PENDING_AI, catch restores NONE
    expect(prisma.submission.update).toHaveBeenNthCalledWith(1, {
      where: { id: 'sub-1' },
      data: { gradingStatus: GradingStatus.PENDING_AI },
    });
    expect(prisma.submission.update).toHaveBeenNthCalledWith(2, {
      where: { id: 'sub-1' },
      data: { gradingStatus: GradingStatus.NONE },
    });

    // Unauthorized teacher rejected
    prisma.submission.findUnique.mockResolvedValueOnce({
      id: 'sub-1',
      status: SubmissionStatus.SUBMITTED_WAITING,
      gradingStatus: GradingStatus.NONE,
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
});
