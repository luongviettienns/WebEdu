import { BadRequestException, NotFoundException } from '@nestjs/common';
import { EnrollmentStatus, Prisma, SessionStatus, SubmissionStatus } from '@prisma/client';
import {
  resolvePagination,
  type PaginationInput,
} from '../../../common/utils/pagination.util.js';
import type {
  ClassAssignmentStatsDto,
  TeacherTrackerStudentRowDto,
} from '../assignments.types.js';
import { hasExplicitTimezoneOffset } from '../dto/assignments.dto.js';
import { toTeacherTrackerStudentRowDto } from '../mappers/assignment.mapper.js';
import type { DbClient } from '../policies/assignment-access.policy.js';

export const SUMMARY_INCLUDE = {
  assessment: {
    select: {
      title: true,
      type: true,
      description: true,
      courseId: true,
      questions: { select: { points: true } },
    },
  },
  class: { select: { code: true, course: { select: { name: true } } } },
  assignedBy: { select: { fullName: true } },
} as const;

const GRADED_COUNT_STATUSES = new Set<SubmissionStatus>([
  SubmissionStatus.AUTO_GRADED_PENDING_REVIEW,
  SubmissionStatus.GRADED,
  SubmissionStatus.RETURNED,
]);

export const REOPENABLE_STATUSES = new Set<SubmissionStatus>([
  SubmissionStatus.SUBMITTED_WAITING,
  SubmissionStatus.AUTO_GRADED_PENDING_REVIEW,
  SubmissionStatus.GRADED,
  SubmissionStatus.RETURNED,
]);

export function computeAssignmentStats(
  enrolledStudentIds: ReadonlySet<string>,
  activeSubmissions: ReadonlyArray<{ studentId: string; status: SubmissionStatus }>,
): ClassAssignmentStatsDto {
  const totalStudents = enrolledStudentIds.size;
  let inProgressCount = 0;
  let submittedWaitingCount = 0;
  let gradedCount = 0;

  for (const sub of activeSubmissions) {
    if (!enrolledStudentIds.has(sub.studentId)) continue;
    if (sub.status === SubmissionStatus.IN_PROGRESS) inProgressCount += 1;
    else if (sub.status === SubmissionStatus.SUBMITTED_WAITING) submittedWaitingCount += 1;
    else if (GRADED_COUNT_STATUSES.has(sub.status)) gradedCount += 1;
  }

  return {
    totalStudents,
    notStartedCount: Math.max(0, totalStudents - (inProgressCount + submittedWaitingCount + gradedCount)),
    inProgressCount,
    submittedWaitingCount,
    gradedCount,
  };
}

export function parseRequiredOffsetIsoDate(raw: string, errorLabel: string): Date {
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    throw new BadRequestException(`${errorLabel} phải ở tương lai`);
  }
  if (!hasExplicitTimezoneOffset(raw)) {
    throw new BadRequestException(`${errorLabel} phải bao gồm múi giờ chuẩn ISO-8601`);
  }
  if (parsed.getTime() <= Date.now()) {
    throw new BadRequestException(`${errorLabel} phải ở tương lai`);
  }
  return parsed;
}

export async function assertAttachableSession(
  tx: Prisma.TransactionClient,
  sessionId: string,
  classId: string,
): Promise<void> {
  const session = await tx.lessonSession.findUnique({
    where: { id: sessionId },
    select: { id: true, classId: true, status: true },
  });
  if (!session) {
    throw new NotFoundException('Không tìm thấy buổi học');
  }
  if (session.classId !== classId) {
    throw new BadRequestException('Buổi học không thuộc lớp được chọn');
  }
  if (session.status === SessionStatus.CANCELLED) {
    throw new BadRequestException('Không thể gắn bài vào buổi học đã hủy');
  }
}

export async function loadAssignmentTrackerData(
  db: DbClient,
  classId: string,
  assignmentId: string,
  questionCount: number,
  query?: PaginationInput,
): Promise<{
  students: TeacherTrackerStudentRowDto[];
  stats: ClassAssignmentStatsDto;
  total: number;
  page: number;
  limit: number;
}> {
  const { page, limit, skip } = resolvePagination(query, 50);
  const [enrollments, activeStatuses] = await Promise.all([
    db.enrollment.findMany({
      where: {
        classId,
        status: { in: [EnrollmentStatus.ACTIVE, EnrollmentStatus.COMPLETED] },
      },
      orderBy: [{ student: { fullName: 'asc' } }, { studentId: 'asc' }],
      select: { student: { select: { id: true, fullName: true, email: true } } },
    }),
    db.submission.findMany({
      where: {
        classAssignmentId: assignmentId,
        status: { not: SubmissionStatus.SUPERSEDED },
      },
      select: { studentId: true, status: true },
    }),
  ]);

  const enrolledIds = new Set<string>();
  const uniqueStudents: Array<{ id: string; fullName: string; email: string }> = [];
  for (const enr of enrollments) {
    if (enrolledIds.has(enr.student.id)) continue;
    enrolledIds.add(enr.student.id);
    uniqueStudents.push(enr.student);
  }

  const total = uniqueStudents.length;
  const pagedStudents = uniqueStudents.slice(skip, skip + limit);
  const stats = computeAssignmentStats(enrolledIds, activeStatuses);

  if (pagedStudents.length === 0) {
    return { students: [], stats, total, page, limit };
  }

  const submissions = await db.submission.findMany({
    where: {
      classAssignmentId: assignmentId,
      studentId: { in: pagedStudents.map((student) => student.id) },
    },
    orderBy: { attemptNumber: 'asc' },
    include: {
      answers: { select: { answerPayload: true } },
      reopenLogs: { select: { reason: true, reopenedAt: true }, orderBy: { reopenedAt: 'asc' } },
    },
  });

  const byStudent = new Map<string, typeof submissions>();
  for (const sub of submissions) {
    const bucket = byStudent.get(sub.studentId) ?? [];
    bucket.push(sub);
    byStudent.set(sub.studentId, bucket);
  }

  const students = pagedStudents.map((student) => {
    const rows = byStudent.get(student.id) ?? [];
    const active = rows.find((r) => r.status !== SubmissionStatus.SUPERSEDED) ?? null;
    const superseded = rows.filter((r) => r.status === SubmissionStatus.SUPERSEDED);
    return toTeacherTrackerStudentRowDto(student, active, superseded, questionCount);
  });

  return { students, stats, total, page, limit };
}
