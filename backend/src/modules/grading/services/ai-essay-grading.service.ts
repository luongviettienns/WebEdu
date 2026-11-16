import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  GradingStatus,
  Prisma,
  QuestionType,
  SubmissionStatus,
} from '@prisma/client';
import type { AuthenticatedUser } from '../../../common/auth/auth.types.js';
import { writeAuditLog } from '../../../common/audit/audit-log.util.js';
import { PrismaService } from '../../../common/prisma/prisma.service.js';
import { AssignmentAccessPolicy } from '../../assignments/policies/assignment-access.policy.js';
import { AiGradingConfigService } from '../../system-settings/services/ai-grading-config.service.js';
import {
  AI_REQUEST_BUDGET_MS,
  callAiProviderForEssayDraft,
  requireAiRequestTime,
  runInBoundedChunks,
} from '../adapters/ai-provider.adapter.js';
import type { AiGradeSubmissionDto, AiSuggestBatchGradeDto } from '../dto/grading.dto.js';
import type {
  AiBatchSuggestGradeItemDto,
  AiBatchSuggestGradeResultDto,
  AiEssaySuggestionItemDto,
  AiGradeSubmissionResultDto,
} from '../grading.types.js';
import { GRADEABLE_ACTIVE_STATUSES } from '../policies/grading-workflow.policy.js';
import {
  lockClassRowForSubmissionTx,
  lockSubmissionRowsTx,
} from './grading-locking.util.js';

const MAX_BATCH_AI_SUBMISSIONS = 20;
const BATCH_AI_CONCURRENCY = 4;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readOptionalString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

@Injectable()
export class AiEssayGradingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accessPolicy: AssignmentAccessPolicy,
    private readonly aiConfigService: AiGradingConfigService,
  ) {}

  private async loadEnabledAiConfig() {
    const config = await this.aiConfigService.getResolvedAiRuntimeConfig();
    if (!config.enabled || !config.apiKey.trim()) {
      throw new BadRequestException('Tính năng gợi ý chấm AI chưa được bật hoặc chưa cấu hình API Key');
    }
    return config;
  }

  async suggestEssayGradesForSubmission(
    submissionId: string,
    actor: AuthenticatedUser,
    dto?: AiGradeSubmissionDto,
    fetchImpl?: typeof fetch,
    onlyMissing = false,
    deadline = Date.now() + AI_REQUEST_BUDGET_MS,
  ): Promise<AiGradeSubmissionResultDto> {
    const submission = await this.prisma.submission.findUnique({
      where: { id: submissionId },
      select: {
        id: true,
        status: true,
        student: { select: { fullName: true } },
        classAssignment: {
          select: {
            classId: true,
            assessment: {
              select: {
                course: { select: { level: true } },
                questions: {
                  where: { type: QuestionType.ESSAY },
                  orderBy: { position: 'asc' },
                  select: { id: true, prompt: true, points: true, payload: true },
                },
              },
            },
          },
        },
        answers: { select: { questionId: true, answerPayload: true, aiSuggestedPoints: true } },
      },
    });
    if (!submission) throw new NotFoundException('Không tìm thấy bài nộp');

    await this.accessPolicy.assertTeacherOrAdminCanAccessClass(this.prisma, actor, submission.classAssignment.classId);

    if (submission.status === SubmissionStatus.IN_PROGRESS || submission.status === SubmissionStatus.SUPERSEDED) {
      throw new BadRequestException('Chỉ có thể gọi AI gợi ý chấm cho bài đã nộp');
    }
    if (!GRADEABLE_ACTIVE_STATUSES.has(submission.status)) {
      throw new ConflictException(
        'Bài nộp đã xác nhận hoặc công bố điểm, không thể chạy lại gợi ý AI',
      );
    }

    const essayQuestions = submission.classAssignment.assessment.questions;
    const targetQuestions = dto?.questionId
      ? essayQuestions.filter((q) => q.id === dto.questionId)
      : essayQuestions;

    if (dto?.questionId && targetQuestions.length === 0) {
      throw new NotFoundException('Không tìm thấy câu tự luận cần gợi ý chấm');
    }
    if (targetQuestions.length === 0) {
      throw new BadRequestException('Bài nộp không có câu tự luận để AI gợi ý');
    }

    const runtimeConfig = await this.loadEnabledAiConfig();

    const answerMap = new Map(submission.answers.map((answer) => [answer.questionId, answer]));
    const studentName = submission.student?.fullName?.trim();
    const transportOptions = { fetchImpl, forbiddenNames: studentName ? [studentName] : undefined };

    const suggestions: AiEssaySuggestionItemDto[] = [];
    for (const question of targetQuestions) {
      const answer = answerMap.get(question.id);
      if (onlyMissing && answer?.aiSuggestedPoints != null) continue;
      const effectiveMaxPoints = question.points;
      const answerObj = answer?.answerPayload;
      const studentAnswer =
        isRecord(answerObj) && typeof answerObj.text === 'string' ? answerObj.text.trim() : '';

      if (!studentAnswer) {
        suggestions.push({
          questionId: question.id,
          maxPoints: effectiveMaxPoints,
          aiSuggestedPoints: 0,
          aiFeedback: 'Học viên để trống câu tự luận này.',
          skippedEmpty: true,
        });
        continue;
      }

      const courseLevel = submission.classAssignment.assessment.course?.level ?? null;
      const qPayload = isRecord(question.payload) ? question.payload : {};
      const timeoutMs = Math.min(runtimeConfig.timeoutMs, requireAiRequestTime(deadline));
      const draft = await callAiProviderForEssayDraft(
        { ...runtimeConfig, timeoutMs },
        {
          prompt: question.prompt,
          maxPoints: effectiveMaxPoints,
          courseLevel,
          sampleAnswer: readOptionalString(qPayload.sampleAnswer),
          rubric: readOptionalString(qPayload.rubric),
          studentAnswer,
        },
        transportOptions,
      ).catch((error: unknown) => {
        requireAiRequestTime(deadline);
        throw error;
      });

      suggestions.push({
        questionId: question.id,
        maxPoints: effectiveMaxPoints,
        aiSuggestedPoints: draft.suggestedPoints,
        aiFeedback: draft.feedback,
        skippedEmpty: false,
      });
    }

    const saved = await this.prisma.$transaction(async (tx) => {
      await lockClassRowForSubmissionTx(tx, submission.id);
      await lockSubmissionRowsTx(tx, [submission.id]);
      const latestSubmission = await tx.submission.findUnique({
        where: { id: submission.id },
        select: { status: true, gradingStatus: true, classAssignment: { select: { classId: true } } },
      });
      if (!latestSubmission) {
        throw new NotFoundException('Không tìm thấy bài nộp');
      }
      await this.accessPolicy.assertTeacherOrAdminCanAccessClass(
        tx,
        actor,
        latestSubmission.classAssignment?.classId ?? submission.classAssignment.classId,
      );
      if (!GRADEABLE_ACTIVE_STATUSES.has(latestSubmission.status)) {
        throw new ConflictException(
          'Trạng thái bài nộp đã thay đổi trong lúc AI đang xử lý; gợi ý AI không được lưu',
        );
      }

      const existingDrafts = onlyMissing && suggestions.length ? await tx.submissionAnswer.findMany({
        where: {
          submissionId: submission.id,
          questionId: { in: suggestions.map((item) => item.questionId) },
          aiSuggestedPoints: { not: null },
        },
        select: { questionId: true },
      }) : [];
      const existingIds = new Set(existingDrafts.map(({ questionId }) => questionId));
      const toSave = suggestions.filter(({ questionId }) => !existingIds.has(questionId));
      if (toSave.length === 0) {
        return { gradingStatus: latestSubmission.gradingStatus, suggestions: toSave };
      }

      for (const item of toSave) {
        await tx.submissionAnswer.upsert({
          where: {
            submissionId_questionId: { submissionId: submission.id, questionId: item.questionId },
          },
          create: {
            submissionId: submission.id,
            questionId: item.questionId,
            answerPayload: {} as Prisma.InputJsonValue,
            aiSuggestedPoints: item.aiSuggestedPoints,
            aiFeedback: item.aiFeedback,
          },
          update: { aiSuggestedPoints: item.aiSuggestedPoints, aiFeedback: item.aiFeedback },
        });
      }

      await tx.submission.update({
        where: { id: submission.id },
        data: { gradingStatus: GradingStatus.AI_DRAFT_READY },
      });
      await writeAuditLog(tx, actor, {
        action: 'SUBMISSION_AI_SUGGESTED',
        targetType: 'Submission',
        targetId: submission.id,
        metadata: {
          provider: runtimeConfig.provider,
          model: runtimeConfig.model,
          suggestedCount: toSave.length,
        },
      });
      return { gradingStatus: GradingStatus.AI_DRAFT_READY, suggestions: toSave };
    });

    return {
      submissionId: submission.id,
      provider: runtimeConfig.provider,
      model: runtimeConfig.model,
      ...saved,
    };
  }

  async suggestEssayGradesForAssignmentBatch(
    assignmentId: string,
    dto: AiSuggestBatchGradeDto | undefined,
    actor: AuthenticatedUser,
    fetchImpl?: typeof fetch,
  ): Promise<AiBatchSuggestGradeResultDto> {
    const deadline = Date.now() + AI_REQUEST_BUDGET_MS;
    const assignment = await this.prisma.classAssignment.findUnique({
      where: { id: assignmentId },
      select: {
        id: true,
        classId: true,
        assessment: {
          select: {
            questions: {
              where: { type: QuestionType.ESSAY },
              select: { id: true },
            },
          },
        },
      },
    });
    if (!assignment) throw new NotFoundException('Không tìm thấy bài giao');

    await this.accessPolicy.assertTeacherOrAdminCanAccessClass(this.prisma, actor, assignment.classId);

    const essayIds = assignment.assessment.questions.map((q) => q.id);
    if (essayIds.length === 0) {
      throw new BadRequestException('Bài giao không có câu tự luận để AI gợi ý');
    }
    if (dto?.questionId && !essayIds.includes(dto.questionId)) {
      throw new NotFoundException('Không tìm thấy câu tự luận cần gợi ý chấm');
    }

    await this.loadEnabledAiConfig();

    const requestedIds = [...new Set(dto?.submissionIds ?? [])];
    if (requestedIds.length > MAX_BATCH_AI_SUBMISSIONS) {
      throw new BadRequestException(`Mỗi lượt chấm AI hàng loạt tối đa ${MAX_BATCH_AI_SUBMISSIONS} bài nộp`);
    }

    let targetIds: string[];
    let validAssignmentSet: Set<string> | null = null;
    if (requestedIds.length > 0) {
      const ownedSubmissions = await this.prisma.submission.findMany({
        where: { classAssignmentId: assignmentId, id: { in: requestedIds } },
        select: { id: true },
      });
      validAssignmentSet = new Set(ownedSubmissions.map((s) => s.id));
      targetIds = requestedIds;
    } else {
      const targetQuestionIds = dto?.questionId ? [dto.questionId] : essayIds;
      const candidateSubmissions = await this.prisma.submission.findMany({
        where: {
          classAssignmentId: assignmentId,
          status: { in: [...GRADEABLE_ACTIVE_STATUSES] },
          OR: targetQuestionIds.map((questionId) => ({
            answers: { none: { questionId, aiSuggestedPoints: { not: null } } },
          })),
        },
        orderBy: [{ submittedAt: 'asc' }, { id: 'asc' }],
        take: MAX_BATCH_AI_SUBMISSIONS,
        select: { id: true },
      });
      targetIds = candidateSubmissions.map((s) => s.id);
    }

    const results = await runInBoundedChunks(targetIds, BATCH_AI_CONCURRENCY, async (submissionId): Promise<AiBatchSuggestGradeItemDto> => {
      if (validAssignmentSet && !validAssignmentSet.has(submissionId)) {
        return { submissionId, ok: false, error: 'Bài nộp không thuộc bài giao này hoặc không tồn tại' };
      }
      try {
        requireAiRequestTime(deadline);
        const res = await this.suggestEssayGradesForSubmission(
          submissionId,
          actor,
          dto?.questionId ? { questionId: dto.questionId } : undefined,
          fetchImpl,
          requestedIds.length === 0,
          deadline,
        );
        return { submissionId, ok: true, gradingStatus: res.gradingStatus, suggestedCount: res.suggestions.length };
      } catch (err) {
        const message = err instanceof Error && err.message ? err.message : 'Không thể gọi AI gợi ý chấm bài nộp này';
        return { submissionId, ok: false, error: message };
      }
    });

    const succeededCount = results.filter((item) => item.ok).length;
    return {
      assignmentId,
      requestedCount: results.length,
      succeededCount,
      failedCount: results.length - succeededCount,
      results,
    };
  }
}
