import {
  BadRequestException,
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
import type { AiGradeSubmissionDto } from '../dto/grading.dto.js';
import type {
  AiEssaySuggestionItemDto,
  AiGradeSubmissionResultDto,
} from '../grading.types.js';

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
        classAssignment: {
          select: {
            classId: true,
            assessment: {
              select: {
                questions: {
                  where: { type: QuestionType.ESSAY },
                  orderBy: { position: 'asc' },
                  select: {
                    id: true,
                    prompt: true,
                    points: true,
                    payload: true,
                  },
                },
              },
            },
          },
        },
        answers: {
          select: {
            questionId: true,
            answerPayload: true,
          },
        },
      },
    });

    if (!submission) {
      throw new NotFoundException('Không tìm thấy bài nộp');
    }

    await this.accessPolicy.assertTeacherOrAdminCanAccessClass(
      this.prisma,
      actor,
      submission.classAssignment.classId,
    );

    if (NON_SUGGESTABLE_STATUSES.has(submission.status)) {
      throw new BadRequestException('Chỉ có thể gọi AI gợi ý chấm cho bài đã nộp');
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
    const previousGradingStatus = submission.gradingStatus;
    const shouldMarkPendingAi =
      submission.status !== SubmissionStatus.GRADED &&
      submission.status !== SubmissionStatus.RETURNED &&
      submission.gradingStatus !== GradingStatus.GRADED;

    if (shouldMarkPendingAi) {
      await this.prisma.submission.update({
        where: { id: submission.id },
        data: { gradingStatus: GradingStatus.PENDING_AI },
      });
    }

    const suggestions: AiEssaySuggestionItemDto[] = [];
    try {
      for (const question of targetQuestions) {
        const answerObj = answerMap.get(question.id);
        const studentAnswer =
          isRecord(answerObj) && typeof answerObj.text === 'string'
            ? answerObj.text.trim()
            : '';

        if (!studentAnswer) {
          suggestions.push({
            questionId: question.id,
            maxPoints: question.points,
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
            maxPoints: question.points,
            sampleAnswer: readOptionalString(qPayload.sampleAnswer),
            rubric: readOptionalString(qPayload.rubric),
            studentAnswer,
          },
          fetchImpl,
        );

        suggestions.push({
          questionId: question.id,
          maxPoints: question.points,
          aiSuggestedPoints: draft.suggestedPoints,
          aiFeedback: draft.feedback,
          skippedEmpty: false,
        });
      }
    } catch (err) {
      if (shouldMarkPendingAi) {
        await this.prisma.submission.update({
          where: { id: submission.id },
          data: { gradingStatus: previousGradingStatus },
        });
      }
      throw err;
    }

    const nextGradingStatus =
      submission.status === SubmissionStatus.GRADED ||
      submission.status === SubmissionStatus.RETURNED ||
      previousGradingStatus === GradingStatus.GRADED
        ? GradingStatus.GRADED
        : GradingStatus.AI_DRAFT_READY;

    await this.prisma.$transaction(async (tx) => {
      for (const item of suggestions) {
        await tx.submissionAnswer.upsert({
          where: {
            submissionId_questionId: {
              submissionId: submission.id,
              questionId: item.questionId,
            },
          },
          create: {
            submissionId: submission.id,
            questionId: item.questionId,
            answerPayload: {} as Prisma.InputJsonValue,
            aiSuggestedPoints: item.aiSuggestedPoints,
            aiFeedback: item.aiFeedback,
          },
          update: {
            aiSuggestedPoints: item.aiSuggestedPoints,
            aiFeedback: item.aiFeedback,
          },
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
}
