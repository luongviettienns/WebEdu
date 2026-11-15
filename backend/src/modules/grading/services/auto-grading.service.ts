import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { SubmissionStatus } from '@prisma/client';
import type { AuthenticatedUser } from '../../../common/auth/auth.types.js';
import { writeAuditLog } from '../../../common/audit/audit-log.util.js';
import { PrismaService } from '../../../common/prisma/prisma.service.js';
import { AssignmentAccessPolicy } from '../../assignments/policies/assignment-access.policy.js';
import type { AutoGradeSubmissionResultDto } from '../grading.types.js';
import { ensureObjectiveAnswersScoredTx } from '../policies/grading-workflow.policy.js';

const NON_GRADABLE_SUBMISSION_STATUSES = new Set<SubmissionStatus>([
  SubmissionStatus.IN_PROGRESS,
  SubmissionStatus.SUPERSEDED,
]);

@Injectable()
export class AutoGradingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accessPolicy: AssignmentAccessPolicy,
  ) {}

  async gradeSubmission(
    submissionId: string,
    actor?: AuthenticatedUser,
  ): Promise<AutoGradeSubmissionResultDto> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "submissions" WHERE id = ${submissionId} FOR UPDATE`;
      const submission = await tx.submission.findUnique({
        where: { id: submissionId },
        include: {
          classAssignment: {
            select: {
              classId: true,
              assessment: {
                select: {
                  questions: {
                    orderBy: { position: 'asc' },
                    select: {
                      id: true,
                      position: true,
                      type: true,
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
              id: true,
              questionId: true,
              answerPayload: true,
              isCorrect: true,
              earnedPoints: true,
              teacherEdited: true,
            },
          },
        },
      });

      if (!submission) {
        throw new NotFoundException('Không tìm thấy bài nộp');
      }
      if (actor) {
        await this.accessPolicy.assertTeacherOrAdminCanAccessClass(
          tx,
          actor,
          submission.classAssignment.classId,
        );
      }
      if (NON_GRADABLE_SUBMISSION_STATUSES.has(submission.status)) {
        throw new BadRequestException('Chỉ có thể chấm tự động bài đã nộp hợp lệ');
      }

      const questions = submission.classAssignment.assessment.questions;
      const { autoScore, hasSubjectiveQuestions, gradedObjectiveCount } =
        await ensureObjectiveAnswersScoredTx(tx, submission.id, questions, submission.answers);

      const shouldTransitionPendingReview =
        !hasSubjectiveQuestions && submission.status === SubmissionStatus.SUBMITTED_WAITING;
      const nextStatus = shouldTransitionPendingReview
        ? SubmissionStatus.AUTO_GRADED_PENDING_REVIEW
        : submission.status;
      const shouldSetDraftTotal = !hasSubjectiveQuestions && submission.totalScore === null;

      const updated = await tx.submission.update({
        where: { id: submission.id },
        data: {
          autoScore,
          status: nextStatus,
          ...(shouldSetDraftTotal ? { totalScore: autoScore } : {}),
        },
        select: {
          id: true,
          status: true,
          gradingStatus: true,
          autoScore: true,
          totalScore: true,
        },
      });

      if (actor) {
        await writeAuditLog(tx, actor, {
          action: 'SUBMISSION_AUTO_GRADED',
          targetType: 'Submission',
          targetId: submission.id,
          metadata: {
            autoScore,
            gradedObjectiveCount,
            hasSubjectiveQuestions,
            nextStatus: updated.status,
          },
        });
      }

      return {
        submissionId: updated.id,
        status: updated.status,
        gradingStatus: updated.gradingStatus,
        autoScore,
        totalScore: updated.totalScore,
        hasSubjectiveQuestions,
        gradedObjectiveCount,
        totalQuestionsCount: questions.length,
      };
    });
  }
}
