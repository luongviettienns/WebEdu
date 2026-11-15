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
import { callAiProviderForEssayDraft } from '../adapters/ai-provider.adapter.js';
import type { AiGradeSubmissionDto, AiSuggestBatchGradeDto } from '../dto/grading.dto.js';
import type {
  AiBatchSuggestGradeItemDto,
  AiBatchSuggestGradeResultDto,
  AiEssaySuggestionItemDto,
  AiGradeSubmissionResultDto,
} from '../grading.types.js';
import { normalizeQuestionPoints } from '../policies/answer-normalizer.policy.js';
import { GRADEABLE_ACTIVE_STATUSES } from '../policies/grading-workflow.policy.js';
import {
  lockClassRowForSubmissionTx,
  lockSubmissionRowsTx,
} from './grading-locking.util.js';

const MAX_BATCH_AI_SUBMISSIONS = 20;

const NON_SUGGESTABLE_STATUSES = new Set<SubmissionStatus>([
  SubmissionStatus.IN_PROGRESS,
  SubmissionStatus.SUPERSEDED,
]);

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

  async suggestEssayGradesForSubmission(
    submissionId: string,
    actor: AuthenticatedUser,
    dto?: AiGradeSubmissionDto,
    fetchImpl?: typeof fetch,
  ): Promise<AiGradeSubmissionResultDto> {
    const submission = await this.prisma.submission.findUnique({
      where: { id: submissionId },
      select: {
        id: true,
        status: true,
        gradingStatus: true,
        student: { select: { fullName: true } },
        classAssignment: {
          select: {
            classId: true,
            assessment: {
              select: {
                questions: {
                  where: { type: QuestionType.ESSAY },
                  orderBy: { position: 'asc' },
                  select: { id: true, prompt: true, points: true, payload: true },
                },
              },
            },
          },
        },
        answers: { select: { questionId: true, answerPayload: true } },
      },
    });
    if (!submission) throw new NotFoundException('Không tìm thấy bài nộp');

    await this.accessPolicy.assertTeacherOrAdminCanAccessClass(
      this.prisma,
      actor,
      submission.classAssignment.classId,
    );

    if (NON_SUGGESTABLE_STATUSES.has(submission.status)) {
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

    const runtimeConfig = await this.aiConfigService.getResolvedAiRuntimeConfig();
    if (!runtimeConfig.enabled || !runtimeConfig.apiKey.trim()) {
      throw new BadRequestException(
        'Tính năng gợi ý chấm AI chưa được bật hoặc chưa cấu hình API Key',
      );
    }

    const answerMap = new Map(submission.answers.map((a) => [a.questionId, a.answerPayload]));
    const forbiddenNames = submission.student?.fullName?.trim()
      ? [submission.student.fullName.trim()]
      : undefined;
    const transportOptions =
      fetchImpl || forbiddenNames ? { fetchImpl, forbiddenNames } : undefined;

    const suggestions: AiEssaySuggestionItemDto[] = [];
    for (const question of targetQuestions) {
      const effectiveMaxPoints = normalizeQuestionPoints(question.points);
      const answerObj = answerMap.get(question.id);
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

      const qPayload = isRecord(question.payload) ? question.payload : {};
      const draft = await callAiProviderForEssayDraft(
        runtimeConfig,
        {
          prompt: question.prompt,
          maxPoints: effectiveMaxPoints,
          sampleAnswer: readOptionalString(qPayload.sampleAnswer),
          rubric: readOptionalString(qPayload.rubric),
          studentAnswer,
        },
        transportOptions,
      );

      suggestions.push({
        questionId: question.id,
        maxPoints: effectiveMaxPoints,
        aiSuggestedPoints: draft.suggestedPoints,
        aiFeedback: draft.feedback,
        skippedEmpty: false,
      });
    }

    const nextGradingStatus = GradingStatus.AI_DRAFT_READY;
    await this.prisma.$transaction(async (tx) => {
      await lockClassRowForSubmissionTx(tx, submission.id);
      await lockSubmissionRowsTx(tx, [submission.id]);
      const latestSubmission = await tx.submission.findUnique({
        where: { id: submission.id },
        select: { id: true, status: true, classAssignment: { select: { classId: true } } },
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

      for (const item of suggestions) {
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
        data: { gradingStatus: nextGradingStatus },
      });
      await writeAuditLog(tx, actor, {
        action: 'SUBMISSION_AI_SUGGESTED',
        targetType: 'Submission',
        targetId: submission.id,
        metadata: {
          provider: runtimeConfig.provider,
          model: runtimeConfig.model,
          suggestedCount: suggestions.length,
        },
      });
    });

    return {
      submissionId: submission.id,
      gradingStatus: nextGradingStatus,
      provider: runtimeConfig.provider,
      model: runtimeConfig.model,
      suggestions,
    };
  }

  async suggestEssayGradesForAssignmentBatch(
    assignmentId: string,
    dto: AiSuggestBatchGradeDto | undefined,
    actor: AuthenticatedUser,
    fetchImpl?: typeof fetch,
  ): Promise<AiBatchSuggestGradeResultDto> {
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

    const runtimeConfig = await this.aiConfigService.getResolvedAiRuntimeConfig();
    if (!runtimeConfig.enabled || !runtimeConfig.apiKey.trim()) {
      throw new BadRequestException('Tính năng gợi ý chấm AI chưa được bật hoặc chưa cấu hình API Key');
    }

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
        where: { classAssignmentId: assignmentId, status: { in: [...GRADEABLE_ACTIVE_STATUSES] } },
        orderBy: [{ submittedAt: 'asc' }, { id: 'asc' }],
        select: {
          id: true,
          gradingStatus: true,
          answers: {
            where: { questionId: { in: targetQuestionIds }, aiSuggestedPoints: { not: null } },
            select: { questionId: true },
          },
        },
      });
      targetIds = candidateSubmissions
        .filter((s) =>
          Array.isArray(s.answers)
            ? s.answers.length < targetQuestionIds.length
            : s.gradingStatus !== GradingStatus.AI_DRAFT_READY,
        )
        .slice(0, MAX_BATCH_AI_SUBMISSIONS)
        .map((s) => s.id);
    }

    const results: AiBatchSuggestGradeItemDto[] = [];
    for (const submissionId of targetIds) {
      if (validAssignmentSet && !validAssignmentSet.has(submissionId)) {
        results.push({ submissionId, ok: false, error: 'Bài nộp không thuộc bài giao này hoặc không tồn tại' });
        continue;
      }

      try {
        const res = await this.suggestEssayGradesForSubmission(
          submissionId,
          actor,
          dto?.questionId ? { questionId: dto.questionId } : undefined,
          fetchImpl,
        );
        results.push({ submissionId, ok: true, gradingStatus: res.gradingStatus, suggestedCount: res.suggestions.length });
      } catch (err) {
        results.push({
          submissionId,
          ok: false,
          error: err instanceof Error && err.message ? err.message : 'Không thể gọi AI gợi ý chấm bài nộp này',
        });
      }
    }

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
