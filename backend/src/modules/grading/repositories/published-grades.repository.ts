import { Injectable, NotFoundException } from '@nestjs/common';
import { SubmissionStatus } from '@prisma/client';
import type { AuthenticatedUser } from '../../../common/auth/auth.types.js';
import { PrismaService } from '../../../common/prisma/prisma.service.js';
import { getDisplayStatusLabel } from '../../assignments/mappers/assignment.mapper.js';
import { AssignmentAccessPolicy } from '../../assignments/policies/assignment-access.policy.js';
import type { StudentPublishedResultResponseDto } from '../grading.types.js';
import { toPublishedStudentQuestionResult } from '../mappers/grading-result.mapper.js';
import { roundToQuarter } from '../policies/answer-normalizer.policy.js';

@Injectable()
export class PublishedGradesRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accessPolicy: AssignmentAccessPolicy,
  ) {}

  async getStudentPublishedResult(
    assignmentId: string,
    actor: AuthenticatedUser,
  ): Promise<StudentPublishedResultResponseDto> {
    const assignment = await this.prisma.classAssignment.findUnique({
      where: { id: assignmentId },
      include: {
        assessment: {
          select: {
            title: true,
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
    });

    if (!assignment) {
      throw new NotFoundException('Không tìm thấy bài giao');
    }

    await this.accessPolicy.assertStudentEnrolledInClass(
      this.prisma,
      actor.id,
      assignment.classId,
    );

    const submission = await this.prisma.submission.findFirst({
      where: {
        classAssignmentId: assignmentId,
        studentId: actor.id,
        status: { not: SubmissionStatus.SUPERSEDED },
      },
      select: {
        id: true,
        attemptNumber: true,
        status: true,
        submittedAt: true,
        returnedAt: true,
        gradeUpdatedAt: true,
        autoSubmitted: true,
        autoScore: true,
        totalScore: true,
        teacherFeedback: true,
        answers: {
          select: {
            questionId: true,
            answerPayload: true,
            isCorrect: true,
            earnedPoints: true,
            teacherComment: true,
          },
        },
      },
    });

    const className = assignment.class.course?.name ?? assignment.class.code;
    if (!submission) {
      return {
        assignmentId: assignment.id,
        assessmentTitle: assignment.assessment.title,
        classCode: assignment.class.code,
        className,
        dueAt: assignment.dueAt.toISOString(),
        isPublished: false,
        status: 'NOT_STARTED',
        displayStatusLabel: getDisplayStatusLabel('NOT_STARTED'),
        message: 'Bạn chưa nộp bài tập này.',
        result: null,
      };
    }

    if (submission.status !== SubmissionStatus.RETURNED) {
      return {
        assignmentId: assignment.id,
        assessmentTitle: assignment.assessment.title,
        classCode: assignment.class.code,
        className,
        dueAt: assignment.dueAt.toISOString(),
        isPublished: false,
        status: submission.status,
        displayStatusLabel: getDisplayStatusLabel(submission.status),
        message: 'Bài đã nộp — Đang chờ giáo viên chấm và công bố điểm',
        result: null,
      };
    }

    const answerByQuestion = new Map(submission.answers.map((ans) => [ans.questionId, ans]));
    const maxScore = roundToQuarter(
      assignment.assessment.questions.reduce((sum, q) => sum + q.points, 0),
    );

    return {
      assignmentId: assignment.id,
      assessmentTitle: assignment.assessment.title,
      classCode: assignment.class.code,
      className,
      dueAt: assignment.dueAt.toISOString(),
      isPublished: true,
      status: submission.status,
      displayStatusLabel: getDisplayStatusLabel(submission.status),
      message: null,
      result: {
        submissionId: submission.id,
        attemptNumber: submission.attemptNumber,
        submittedAt: submission.submittedAt ? submission.submittedAt.toISOString() : null,
        returnedAt: submission.returnedAt ? submission.returnedAt.toISOString() : null,
        gradeUpdatedAt: submission.gradeUpdatedAt ? submission.gradeUpdatedAt.toISOString() : null,
        autoSubmitted: submission.autoSubmitted,
        autoScore: submission.autoScore,
        totalScore: submission.totalScore,
        maxScore,
        teacherFeedback: submission.teacherFeedback,
        questions: assignment.assessment.questions.map((q) =>
          toPublishedStudentQuestionResult(q, answerByQuestion.get(q.id)),
        ),
      },
    };
  }
}
