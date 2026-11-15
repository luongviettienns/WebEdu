import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EnrollmentStatus, Prisma, SubmissionStatus } from '@prisma/client';
import type { AuthenticatedUser } from '../../../common/auth/auth.types.js';
import { writeAuditLog } from '../../../common/audit/audit-log.util.js';
import { PrismaService } from '../../../common/prisma/prisma.service.js';
import {
  getDisplayStatusLabel,
  resolveEffectiveDueAt,
} from '../../assignments/mappers/assignment.mapper.js';
import { AssignmentAccessPolicy } from '../../assignments/policies/assignment-access.policy.js';
import type { ManualGradeSubmissionDto } from '../dto/grading.dto.js';
import type {
  ManualGradeMutationResultDto,
  TeacherSubmissionGradingDetailDto,
} from '../grading.types.js';
import {
  toGradeAuditLogItemDto,
  toGradingTrackerAssignmentDto,
  toTeacherGradingQuestionDetail,
} from '../mappers/grading-result.mapper.js';
import { clampScoreToQuarter } from '../policies/answer-normalizer.policy.js';
import {
  assertValidQuestionScore,
  computeSubmissionScoreSummary,
  CONFIRMED_OR_PUBLISHED_STATUSES,
  GRADEABLE_ACTIVE_STATUSES,
  resolveNavNeighbors,
} from '../policies/grading-workflow.policy.js';

@Injectable()
export class TeacherGradingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accessPolicy: AssignmentAccessPolicy,
  ) {}

  async getSubmissionGradingDetail(
    submissionId: string,
    actor: AuthenticatedUser,
  ): Promise<TeacherSubmissionGradingDetailDto> {
    const submission = await this.prisma.submission.findUnique({
      where: { id: submissionId },
      include: {
        student: { select: { id: true, fullName: true, email: true } },
        gradedBy: { select: { fullName: true } },
        classAssignment: {
          include: {
            assessment: {
              select: {
                title: true,
                type: true,
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
            class: { select: { code: true, course: { select: { name: true } } } },
          },
        },
        answers: true,
        gradeAuditLogs: {
          orderBy: { createdAt: 'desc' },
          include: {
            actor: { select: { fullName: true } },
            answer: { select: { question: { select: { id: true, position: true } } } },
          },
        },
      },
    });

    if (!submission) {
      throw new NotFoundException('Không tìm thấy bài nộp');
    }

    await this.accessPolicy.assertTeacherOrAdminCanReadClass(
      this.prisma,
      actor,
      submission.classAssignment.classId,
    );

    if (
      submission.status === SubmissionStatus.IN_PROGRESS ||
      submission.status === SubmissionStatus.SUPERSEDED
    ) {
      throw new BadRequestException(
        'Chỉ có thể xem chi tiết chấm bài cho bài đã nộp hoặc đã ghi nhận điểm',
      );
    }

    const siblingSubs = await this.prisma.submission.findMany({
      where: {
        classAssignmentId: submission.classAssignmentId,
        status: {
          notIn: [SubmissionStatus.SUPERSEDED, SubmissionStatus.IN_PROGRESS],
        },
        student: {
          enrollments: {
            some: {
              classId: submission.classAssignment.classId,
              status: { in: [EnrollmentStatus.ACTIVE, EnrollmentStatus.COMPLETED] },
            },
          },
        },
      },
      orderBy: [{ submittedAt: 'asc' }, { createdAt: 'asc' }],
      select: { id: true },
    });

    const questions = submission.classAssignment.assessment.questions;
    const answerByQuestion = new Map(submission.answers.map((ans) => [ans.questionId, ans]));
    const scoreSummary = computeSubmissionScoreSummary(questions, answerByQuestion);
    const effectiveDueAt = resolveEffectiveDueAt(
      submission.classAssignment.dueAt,
      submission.dueAtOverride,
    );
    const isLateSubmission =
      submission.submittedAt !== null &&
      submission.submittedAt.getTime() > effectiveDueAt.getTime();

    return {
      submission: {
        id: submission.id,
        classAssignmentId: submission.classAssignmentId,
        attemptNumber: submission.attemptNumber,
        status: submission.status,
        displayStatusLabel: getDisplayStatusLabel(submission.status),
        gradingStatus: submission.gradingStatus,
        startedAt: submission.startedAt.toISOString(),
        submittedAt: submission.submittedAt ? submission.submittedAt.toISOString() : null,
        autoSubmitted: submission.autoSubmitted,
        autoScore: submission.autoScore,
        totalScore: submission.totalScore,
        teacherFeedback: submission.teacherFeedback,
        gradedAt: submission.gradedAt ? submission.gradedAt.toISOString() : null,
        gradedByName: submission.gradedBy?.fullName ?? null,
        returnedAt: submission.returnedAt ? submission.returnedAt.toISOString() : null,
        gradeUpdatedAt: submission.gradeUpdatedAt ? submission.gradeUpdatedAt.toISOString() : null,
        isLateSubmission,
        hasSubjectiveQuestions: scoreSummary.hasSubjectiveQuestions,
        ungradedSubjectiveCount: scoreSummary.ungradedSubjectiveCount,
      },
      assignment: toGradingTrackerAssignmentDto(submission.classAssignment),
      student: submission.student,
      questions: questions.map((q) =>
        toTeacherGradingQuestionDetail(q, answerByQuestion.get(q.id)),
      ),
      auditLogs: submission.gradeAuditLogs.map(toGradeAuditLogItemDto),
      navigation: resolveNavNeighbors(
        siblingSubs.map((s) => s.id),
        submission.id,
      ),
    };
  }

  async gradeSubmissionManually(
    submissionId: string,
    dto: ManualGradeSubmissionDto,
    actor: AuthenticatedUser,
  ): Promise<ManualGradeMutationResultDto> {
    if ((!dto.answers || dto.answers.length === 0) && dto.teacherFeedback === undefined) {
      throw new BadRequestException('Vui lòng nhập điểm câu hỏi hoặc nhận xét bài làm');
    }

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
                      points: true,
                      payload: true,
                    },
                  },
                },
              },
            },
          },
          answers: true,
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

      if (CONFIRMED_OR_PUBLISHED_STATUSES.has(submission.status)) {
        throw new ConflictException(
          'Bài đã xác nhận hoặc công bố, vui lòng dùng chức năng chỉnh sửa điểm kèm lý do',
        );
      }
      if (!GRADEABLE_ACTIVE_STATUSES.has(submission.status)) {
        throw new BadRequestException('Chỉ có thể chấm thủ công cho bài đã nộp hợp lệ');
      }

      const questions = submission.classAssignment.assessment.questions;
      const questionMap = new Map(questions.map((q) => [q.id, q]));
      const existingByQuestion = new Map(submission.answers.map((a) => [a.questionId, a]));

      for (const item of dto.answers ?? []) {
        const question = questionMap.get(item.questionId);
        if (!question) {
          throw new BadRequestException('Câu hỏi không thuộc đề bài của bài nộp này');
        }

        const existing = existingByQuestion.get(item.questionId);
        let nextPoints: number | undefined;

        if (item.applyAiSuggestion === true) {
          if (existing?.aiSuggestedPoints === null || existing?.aiSuggestedPoints === undefined) {
            throw new BadRequestException('Câu hỏi chưa có điểm gợi ý từ AI để áp dụng');
          }
          nextPoints = clampScoreToQuarter(existing.aiSuggestedPoints, question.points);
        } else if (item.earnedPoints !== undefined) {
          nextPoints = assertValidQuestionScore(
            item.earnedPoints,
            question.points,
            question.position,
          );
        }

        const hasCommentUpdate = item.teacherComment !== undefined;
        const normalizedComment = hasCommentUpdate
          ? item.teacherComment?.trim() || null
          : undefined;
        if (nextPoints === undefined && !hasCommentUpdate) {
          throw new BadRequestException('Cần nhập điểm hoặc nhận xét cho câu hỏi');
        }

        const updateData: Prisma.SubmissionAnswerUpdateInput = {
          ...(nextPoints !== undefined
            ? { earnedPoints: nextPoints, teacherEdited: true }
            : {}),
          ...(normalizedComment !== undefined ? { teacherComment: normalizedComment } : {}),
        };

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
            ...(nextPoints !== undefined
              ? { earnedPoints: nextPoints, teacherEdited: true }
              : {}),
            ...(normalizedComment !== undefined ? { teacherComment: normalizedComment } : {}),
          },
          update: updateData,
        });
      }

      const latestAnswers = await tx.submissionAnswer.findMany({
        where: { submissionId: submission.id },
        select: { questionId: true, earnedPoints: true },
      });
      const latestMap = new Map(latestAnswers.map((a) => [a.questionId, a]));
      const scoreSummary = computeSubmissionScoreSummary(questions, latestMap);

      const nextFeedback =
        dto.teacherFeedback !== undefined
          ? dto.teacherFeedback?.trim() || null
          : submission.teacherFeedback;

      const updated = await tx.submission.update({
        where: { id: submission.id },
        data: {
          totalScore: scoreSummary.totalScore,
          teacherFeedback: nextFeedback,
        },
        select: {
          id: true,
          status: true,
          gradingStatus: true,
          autoScore: true,
          totalScore: true,
          teacherFeedback: true,
        },
      });

      await writeAuditLog(tx, actor, {
        action: 'SUBMISSION_MANUALLY_GRADED',
        targetType: 'Submission',
        targetId: submission.id,
        metadata: {
          gradedQuestionIds: (dto.answers ?? []).map((a) => a.questionId),
          totalScore: updated.totalScore,
          ungradedSubjectiveCount: scoreSummary.ungradedSubjectiveCount,
        },
      });

      return {
        submissionId: updated.id,
        status: updated.status,
        gradingStatus: updated.gradingStatus,
        autoScore: updated.autoScore,
        totalScore: updated.totalScore,
        teacherFeedback: updated.teacherFeedback,
        ungradedSubjectiveCount: scoreSummary.ungradedSubjectiveCount,
        readyToConfirm: scoreSummary.ungradedSubjectiveCount === 0,
      };
    });
  }
}
