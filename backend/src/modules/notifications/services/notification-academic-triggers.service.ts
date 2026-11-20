import { Injectable } from '@nestjs/common';
import {
  EnrollmentStatus,
  NotificationType,
  Prisma,
  SubmissionStatus,
} from '@prisma/client';
import type {
  DispatchNotificationInput,
  SessionChangedNotificationInput,
} from '../notifications.types.js';
import {
  buildNotificationContent,
  type BuildNotificationContentInput,
} from '../utils/notification-message.util.js';
import { NotificationDispatchService } from './notification-dispatch.service.js';

export type { SessionChangedNotificationInput };

@Injectable()
export class NotificationAcademicTriggersService {
  constructor(private readonly dispatchService: NotificationDispatchService) {}

  private async notifySingleRecipientTx(
    tx: Prisma.TransactionClient,
    params: {
      recipientId: string;
      actorId?: string;
      linkPath: string;
      dedupKey?: string;
      content: BuildNotificationContentInput;
    },
  ): Promise<void> {
    if (params.recipientId === params.actorId) return;
    const copy = buildNotificationContent(params.content);
    await this.dispatchService.dispatchManyTx(tx, [
      {
        recipientId: params.recipientId,
        type: params.content.type,
        ...copy,
        linkPath: params.linkPath,
        ...(params.dedupKey ? { dedupKey: params.dedupKey } : {}),
      },
    ]);
  }

  async onNewStudentRegisteredTx(
    tx: Prisma.TransactionClient,
    input: { studentId: string; fullName: string },
  ): Promise<void> {
    const adminIds = await this.dispatchService.resolveActiveAdminRecipientIdsTx(
      tx,
      input.studentId,
    );
    if (adminIds.length === 0) return;
    const copy = buildNotificationContent({
      type: NotificationType.NEW_STUDENT_PENDING_CLASS,
      studentName: input.fullName,
    });
    await this.dispatchService.dispatchManyTx(
      tx,
      adminIds.map((recipientId) => ({
        recipientId,
        type: NotificationType.NEW_STUDENT_PENDING_CLASS,
        ...copy,
        linkPath: '/admin/students/pending',
        dedupKey: `pending_student:${input.studentId}`,
      })),
    );
  }

  async onStudentsPlacedTx(
    tx: Prisma.TransactionClient,
    input: { studentIds: ReadonlyArray<string>; classCode: string; actorId?: string },
  ): Promise<void> {
    const recipientIds = [...new Set(input.studentIds)].filter(
      (id) => id !== input.actorId,
    );
    if (recipientIds.length === 0) return;
    const copy = buildNotificationContent({
      type: NotificationType.STUDENT_ENROLLED,
      classCode: input.classCode,
    });
    await this.dispatchService.dispatchManyTx(
      tx,
      recipientIds.map((recipientId) => ({
        recipientId,
        type: NotificationType.STUDENT_ENROLLED,
        ...copy,
        linkPath: '/student/overview',
      })),
    );
  }

  async onStudentTransferredTx(
    tx: Prisma.TransactionClient,
    input: {
      studentId: string;
      sourceClassCode: string;
      targetClassCode: string;
      actorId?: string;
    },
  ): Promise<void> {
    await this.notifySingleRecipientTx(tx, {
      recipientId: input.studentId,
      actorId: input.actorId,
      linkPath: '/student/overview',
      content: {
        type: NotificationType.STUDENT_TRANSFERRED,
        sourceClassCode: input.sourceClassCode,
        targetClassCode: input.targetClassCode,
      },
    });
  }

  async onStudentDroppedTx(
    tx: Prisma.TransactionClient,
    input: { studentId: string; classCode: string; actorId?: string },
  ): Promise<void> {
    await this.notifySingleRecipientTx(tx, {
      recipientId: input.studentId,
      actorId: input.actorId,
      linkPath: '/student/overview',
      content: {
        type: NotificationType.STUDENT_DROPPED,
        classCode: input.classCode,
      },
    });
  }

  async onTeacherAssignedClassTx(
    tx: Prisma.TransactionClient,
    input: {
      teacherId: string;
      classId: string;
      classCode: string;
      courseName: string;
      isReassignment?: boolean;
      actorId?: string;
    },
  ): Promise<void> {
    await this.notifySingleRecipientTx(tx, {
      recipientId: input.teacherId,
      actorId: input.actorId,
      linkPath: `/teacher/classes/${input.classId}`,
      content: {
        type: NotificationType.TEACHER_ASSIGNED_CLASS,
        classCode: input.classCode,
        courseName: input.courseName,
        isReassignment: input.isReassignment,
      },
    });
  }

  async onSessionChangedTx(
    tx: Prisma.TransactionClient,
    input: SessionChangedNotificationInput,
  ): Promise<void> {
    const activeEnrollments = await tx.enrollment.findMany({
      where: { classId: input.classId, status: EnrollmentStatus.ACTIVE },
      select: { studentId: true },
    });
    const copy = buildNotificationContent(input);
    const items: DispatchNotificationInput[] = [];

    for (const enrollment of activeEnrollments) {
      if (enrollment.studentId === input.actorId) continue;
      items.push({
        recipientId: enrollment.studentId,
        type: input.type,
        ...copy,
        linkPath: '/student/schedule',
      });
    }
    if (input.teacherId && input.teacherId !== input.actorId) {
      items.push({
        recipientId: input.teacherId,
        type: input.type,
        ...copy,
        linkPath: '/teacher/schedules',
      });
    }
    await this.dispatchService.dispatchManyTx(tx, items);
  }

  async onAssignmentPublishedToClassTx(
    tx: Prisma.TransactionClient,
    input: {
      assignmentId: string;
      classId: string;
      classCode: string;
      assessmentTitle: string;
      dueAt: Date;
      actorId?: string;
    },
  ): Promise<void> {
    const enrollments = await tx.enrollment.findMany({
      where: { classId: input.classId, status: EnrollmentStatus.ACTIVE },
      select: { studentId: true },
    });
    const copy = buildNotificationContent({
      type: NotificationType.ASSIGNMENT_ASSIGNED,
      assessmentTitle: input.assessmentTitle,
      classCode: input.classCode,
      dueAt: input.dueAt,
    });
    const items = enrollments
      .filter((e) => e.studentId !== input.actorId)
      .map((e) => ({
        recipientId: e.studentId,
        type: NotificationType.ASSIGNMENT_ASSIGNED,
        ...copy,
        linkPath: `/student/assignments/${input.assignmentId}`,
        dedupKey: `assign:${input.assignmentId}`,
      }));
    await this.dispatchService.dispatchManyTx(tx, items);
  }

  async onSubmissionReopenedTx(
    tx: Prisma.TransactionClient,
    input: { assignmentId: string; assessmentTitle: string; studentId: string; dueAt?: Date | null; actorId?: string },
  ): Promise<void> {
    await this.notifySingleRecipientTx(tx, {
      recipientId: input.studentId,
      actorId: input.actorId,
      linkPath: `/student/assignments/${input.assignmentId}`,
      content: { type: NotificationType.SUBMISSION_REOPENED, assessmentTitle: input.assessmentTitle, dueAt: input.dueAt },
    });
  }

  async onSubmissionPendingGradingTx(
    tx: Prisma.TransactionClient,
    input: { assignmentId: string; studentId: string },
  ): Promise<void> {
    const assignment = await tx.classAssignment.findUnique({
      where: { id: input.assignmentId },
      select: { id: true, assessment: { select: { title: true } }, class: { select: { teacherId: true } } },
    });
    if (!assignment || assignment.class.teacherId === input.studentId) return;

    // Serialize count + dedup upsert per assignment so concurrent submits cannot overwrite with a lower count.
    if (typeof tx.$executeRaw === 'function') {
      await tx.$executeRaw`
        SELECT pg_advisory_xact_lock(hashtextextended(${`sub_pending:${input.assignmentId}`}, 0))
      `;
    }

    const pendingCount = await tx.submission.count({
      where: {
        classAssignmentId: input.assignmentId,
        status: { in: [SubmissionStatus.SUBMITTED_WAITING, SubmissionStatus.AUTO_GRADED_PENDING_REVIEW] },
      },
    });
    if (pendingCount <= 0) return;

    const copy = buildNotificationContent({
      type: NotificationType.SUBMISSION_PENDING_GRADING,
      assessmentTitle: assignment.assessment.title,
      pendingCount,
    });
    await this.dispatchService.upsertDedupNotificationTx(tx, {
      recipientId: assignment.class.teacherId,
      type: NotificationType.SUBMISSION_PENDING_GRADING,
      ...copy,
      linkPath: `/teacher/assignments/${input.assignmentId}/grading`,
      dedupKey: `sub_pending:${input.assignmentId}`,
    });
  }

  async onGradesPublishedTx(
    tx: Prisma.TransactionClient,
    input: { assignmentId: string; studentIds: ReadonlyArray<string>; actorId?: string },
  ): Promise<void> {
    const targetIds = [...new Set(input.studentIds)].filter((id) => id !== input.actorId);
    if (targetIds.length === 0) return;

    const assignment = await tx.classAssignment.findUnique({
      where: { id: input.assignmentId },
      select: { assessment: { select: { title: true, questions: { select: { points: true } } } } },
    });
    if (!assignment) return;

    const maxScore = Math.round(assignment.assessment.questions.reduce((sum, q) => sum + q.points, 0) * 100) / 100;
    const submissions = await tx.submission.findMany({
      where: { classAssignmentId: input.assignmentId, studentId: { in: targetIds }, status: SubmissionStatus.RETURNED },
      orderBy: { attemptNumber: 'desc' },
      select: { id: true, studentId: true, totalScore: true },
    });
    const scoreByStudent = new Map<string, { id: string; totalScore: number }>();
    for (const sub of submissions) {
      if (!scoreByStudent.has(sub.studentId) && sub.totalScore !== null) {
        scoreByStudent.set(sub.studentId, { id: sub.id, totalScore: sub.totalScore });
      }
    }

    const items: DispatchNotificationInput[] = [];
    for (const studentId of targetIds) {
      const entry = scoreByStudent.get(studentId);
      if (!entry) continue;
      const copy = buildNotificationContent({
        type: NotificationType.GRADE_PUBLISHED,
        assessmentTitle: assignment.assessment.title,
        totalScore: entry.totalScore,
        maxScore,
      });
      items.push({
        recipientId: studentId,
        type: NotificationType.GRADE_PUBLISHED,
        ...copy,
        linkPath: `/student/assignments/${input.assignmentId}?mode=review`,
        dedupKey: `grade_pub:${entry.id}`,
      });
    }
    await this.dispatchService.dispatchManyTx(tx, items);
  }

  async onPublishedGradeAdjustedTx(
    tx: Prisma.TransactionClient,
    input: { assignmentId: string; studentId: string; assessmentTitle: string; totalScore: number; maxScore: number; actorId?: string },
  ): Promise<void> {
    await this.notifySingleRecipientTx(tx, {
      recipientId: input.studentId,
      actorId: input.actorId,
      linkPath: `/student/assignments/${input.assignmentId}?mode=review`,
      content: { type: NotificationType.GRADE_UPDATED, assessmentTitle: input.assessmentTitle, totalScore: input.totalScore, maxScore: input.maxScore },
    });
  }
}
