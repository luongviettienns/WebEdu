import {
  BadRequestException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { Prisma, SubmissionStatus } from '@prisma/client';
import type { AuthenticatedUser } from '../../../common/auth/auth.types.js';
import { writeAuditLog } from '../../../common/audit/audit-log.util.js';
import { PrismaService } from '../../../common/prisma/prisma.service.js';
import { AssignmentAccessPolicy } from '../../assignments/policies/assignment-access.policy.js';
import { NotificationAcademicTriggersService } from '../../notifications/services/notification-academic-triggers.service.js';
import type { AdjustGradeSubmissionDto } from '../dto/grading.dto.js';
import type { AdjustGradeResultDto } from '../grading.types.js';
import { sumQuestionMaxScore } from '../policies/answer-normalizer.policy.js';
import {
  assertValidQuestionScore,
  computeSubmissionScoreSummary,
  CONFIRMED_OR_PUBLISHED_STATUSES,
} from '../policies/grading-workflow.policy.js';
import {
  assertNoDuplicateQuestionIds,
  assertOptimisticAnswerMatch,
  assertOptimisticTeacherFeedbackMatch,
  lockClassRowForSubmissionTx,
} from './grading-locking.util.js';

@Injectable()
export class GradeAdjustmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accessPolicy: AssignmentAccessPolicy,
    @Optional() private readonly academicNotifications?: NotificationAcademicTriggersService,
  ) {}

  async adjustConfirmedOrPublishedGrade(
    submissionId: string,
    dto: AdjustGradeSubmissionDto,
    actor: AuthenticatedUser,
  ): Promise<AdjustGradeResultDto> {
    const reason = dto.reason.trim();
    if (!reason) {
      throw new BadRequestException('Lý do chỉnh sửa điểm là bắt buộc');
    }
    if ((!dto.answers || dto.answers.length === 0) && dto.teacherFeedback === undefined) {
      throw new BadRequestException('Vui lòng chọn ít nhất một câu hỏi hoặc nhận xét cần chỉnh sửa');
    }

    assertNoDuplicateQuestionIds(
      dto.answers ?? [],
      'Danh sách câu hỏi điều chỉnh có questionId bị trùng lặp',
    );
    for (const item of dto.answers ?? []) {
      if (item.earnedPoints === undefined && item.teacherComment === undefined) {
        throw new BadRequestException('Mỗi câu hỏi điều chỉnh phải thay đổi điểm hoặc nhận xét');
      }
    }

    const now = new Date();
    return this.prisma.$transaction(async (tx) => {
      await lockClassRowForSubmissionTx(tx, submissionId);
      await tx.$queryRaw`SELECT id FROM "submissions" WHERE id = ${submissionId} FOR UPDATE`;
      const submission = await tx.submission.findUnique({
        where: { id: submissionId },
        include: {
          classAssignment: {
            select: {
              classId: true,
              assessment: {
                select: {
                  title: true,
                  questions: {
                    orderBy: { position: 'asc' },
                    select: { id: true, position: true, type: true, points: true, payload: true },
                  },
                },
              },
            },
          },
          answers: {
            select: {
              id: true,
              questionId: true,
              earnedPoints: true,
              teacherComment: true,
            },
          },
        },
      });

      if (!submission) {
        throw new NotFoundException('Không tìm thấy bài nộp');
      }

      await this.accessPolicy.assertTeacherOrAdminCanAccessClass(
        tx,
        actor,
        submission.classAssignment.classId,
      );

      if (!CONFIRMED_OR_PUBLISHED_STATUSES.has(submission.status)) {
        throw new BadRequestException(
          'Chỉ có thể chỉnh sửa điểm sau khi bài đã xác nhận hoặc công bố',
        );
      }

      assertOptimisticTeacherFeedbackMatch(
        submission.teacherFeedback,
        dto.previousTeacherFeedback,
      );

      const questions = submission.classAssignment.assessment.questions;
      const questionMap = new Map(questions.map((q) => [q.id, q]));
      const existingByQuestion = new Map(submission.answers.map((a) => [a.questionId, a]));

      let auditLogsCreated = 0;
      let scoreFieldChanged = false;

      for (const item of dto.answers ?? []) {
        const question = questionMap.get(item.questionId);
        if (!question) {
          throw new BadRequestException('Câu hỏi không thuộc đề bài của bài nộp này');
        }

        const existing = existingByQuestion.get(question.id);
        const existingPoints =
          existing?.earnedPoints !== null && existing?.earnedPoints !== undefined
            ? Number(existing.earnedPoints)
            : null;
        const existingComment = existing?.teacherComment?.trim() || null;

        assertOptimisticAnswerMatch({
          questionPosition: question.position,
          existingPoints,
          existingComment,
          previousEarnedPoints: item.previousEarnedPoints,
          previousTeacherComment: item.previousTeacherComment,
        });

        const nextCommentPatch =
          item.teacherComment !== undefined
            ? { teacherComment: item.teacherComment?.trim() || null }
            : {};

        if (item.earnedPoints !== undefined) {
          const newPoints = assertValidQuestionScore(
            item.earnedPoints,
            question.points,
            question.position,
          );
          const oldPoints = existingPoints ?? 0;
          scoreFieldChanged = true;

          const savedAnswer = await tx.submissionAnswer.upsert({
            where: {
              submissionId_questionId: {
                submissionId: submission.id,
                questionId: question.id,
              },
            },
            create: {
              submissionId: submission.id,
              questionId: question.id,
              answerPayload: {} as Prisma.InputJsonValue,
              earnedPoints: newPoints,
              teacherEdited: true,
              ...nextCommentPatch,
            },
            update: {
              earnedPoints: newPoints,
              teacherEdited: true,
              ...nextCommentPatch,
            },
            select: { id: true },
          });

          if (oldPoints !== newPoints || existing?.earnedPoints === null || existing === undefined) {
            await tx.gradeAuditLog.create({
              data: {
                submissionId: submission.id,
                answerId: savedAnswer.id,
                actorId: actor.id,
                oldScore: oldPoints,
                newScore: newPoints,
                reason,
              },
            });
            auditLogsCreated += 1;
          }
        } else {
          await tx.submissionAnswer.upsert({
            where: {
              submissionId_questionId: {
                submissionId: submission.id,
                questionId: question.id,
              },
            },
            create: {
              submissionId: submission.id,
              questionId: question.id,
              answerPayload: {} as Prisma.InputJsonValue,
              earnedPoints: null,
              teacherEdited: true,
              ...nextCommentPatch,
            },
            update: {
              teacherEdited: true,
              ...nextCommentPatch,
            },
            select: { id: true },
          });
        }
      }

      let nextTotalScore = submission.totalScore ?? 0;
      if (scoreFieldChanged) {
        const latestAnswers = await tx.submissionAnswer.findMany({
          where: { submissionId: submission.id },
          select: { questionId: true, earnedPoints: true },
        });
        const latestMap = new Map(latestAnswers.map((a) => [a.questionId, a]));
        const summary = computeSubmissionScoreSummary(questions, latestMap);
        nextTotalScore = summary.totalScore ?? 0;
      }

      const isPublished = submission.status === SubmissionStatus.RETURNED;
      const nextFeedback =
        dto.teacherFeedback !== undefined
          ? dto.teacherFeedback?.trim() || null
          : submission.teacherFeedback;

      const updated = await tx.submission.update({
        where: { id: submission.id },
        data: {
          totalScore: nextTotalScore,
          teacherFeedback: nextFeedback,
          gradedAt: now,
          gradedById: actor.id,
          ...(isPublished ? { gradeUpdatedAt: now } : {}),
        },
        select: {
          id: true,
          status: true,
          totalScore: true,
          teacherFeedback: true,
          gradeUpdatedAt: true,
        },
      });

      await writeAuditLog(tx, actor, {
        action: 'SUBMISSION_GRADE_ADJUSTED',
        targetType: 'Submission',
        targetId: submission.id,
        metadata: {
          previousTotalScore: submission.totalScore,
          newTotalScore: updated.totalScore,
          reason,
          isPublished,
          auditLogsCreated,
        },
      });
      if (isPublished) {
        await this.academicNotifications?.onPublishedGradeAdjustedTx(tx, {
          assignmentId: submission.classAssignmentId,
          studentId: submission.studentId,
          assessmentTitle: submission.classAssignment.assessment.title ?? 'Bài tập',
          totalScore: updated.totalScore ?? 0,
          maxScore: sumQuestionMaxScore(questions),
          actorId: actor.id,
        });
      }

      return {
        submissionId: updated.id,
        status: updated.status,
        previousTotalScore: submission.totalScore,
        totalScore: updated.totalScore ?? 0,
        teacherFeedback: updated.teacherFeedback,
        gradeUpdatedAt: updated.gradeUpdatedAt ? updated.gradeUpdatedAt.toISOString() : null,
        auditLogsCreated,
      };
    });
  }
}
