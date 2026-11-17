import { BadRequestException, NotFoundException } from '@nestjs/common';
import { EnrollmentStatus, Prisma, SessionStatus, SubmissionStatus } from '@prisma/client';
import type { PrismaService } from '../../../common/prisma/prisma.service.js';
import {
  resolvePagination,
  type PaginationInput,
} from '../../../common/utils/pagination.util.js';
import type {
  ClassAssignmentStatsDto,
  TeacherTrackerStudentRowDto,
} from '../assignments.types.js';
import {
  hasExplicitTimezoneOffset,
  type AssignmentTrackerStatusFilter,
} from '../dto/assignments.dto.js';
import { toTeacherTrackerStudentRowDto } from '../mappers/assignment.mapper.js';

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

function aggregateAssignmentStats(
  totalStudents: number,
  entries: ReadonlyArray<{ status: SubmissionStatus; count: number }>,
): ClassAssignmentStatsDto {
  let inProgressCount = 0;
  let submittedWaitingCount = 0;
  let gradedCount = 0;

  for (const entry of entries) {
    if (entry.status === SubmissionStatus.IN_PROGRESS) inProgressCount += entry.count;
    else if (entry.status === SubmissionStatus.SUBMITTED_WAITING) submittedWaitingCount += entry.count;
    else if (GRADED_COUNT_STATUSES.has(entry.status)) gradedCount += entry.count;
  }

  return {
    totalStudents,
    notStartedCount: Math.max(
      0,
      totalStudents - (inProgressCount + submittedWaitingCount + gradedCount),
    ),
    inProgressCount,
    submittedWaitingCount,
    gradedCount,
  };
}

export function computeAssignmentStats(
  enrolledStudentIds: ReadonlySet<string>,
  activeSubmissions: ReadonlyArray<{ studentId: string; status: SubmissionStatus }>,
): ClassAssignmentStatsDto {
  const entries = activeSubmissions
    .filter((sub) => enrolledStudentIds.has(sub.studentId))
    .map((sub) => ({ status: sub.status, count: 1 }));
  return aggregateAssignmentStats(enrolledStudentIds.size, entries);
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

function buildTrackerStudentSubmissionFilter(
  assignmentId: string,
  status?: AssignmentTrackerStatusFilter,
): Prisma.UserWhereInput | null {
  if (!status || status === 'ALL') return null;
  if (status === 'NOT_STARTED') {
    return {
      studentSubmissions: {
        none: { classAssignmentId: assignmentId, status: { not: SubmissionStatus.SUPERSEDED } },
      },
    };
  }
  const matchStatuses =
    status === 'GRADED'
      ? [...GRADED_COUNT_STATUSES]
      : [status === 'IN_PROGRESS' ? SubmissionStatus.IN_PROGRESS : SubmissionStatus.SUBMITTED_WAITING];
  return {
    studentSubmissions: {
      some: { classAssignmentId: assignmentId, status: { in: matchStatuses } },
    },
  };
}

export async function loadAssignmentTrackerData(
  db: PrismaService,
  classId: string,
  assignmentId: string,
  questionCount: number,
  query?: PaginationInput & { status?: AssignmentTrackerStatusFilter },
): Promise<{
  students: TeacherTrackerStudentRowDto[];
  stats: ClassAssignmentStatsDto;
  total: number;
  page: number;
  limit: number;
}> {
  const { page, limit, skip } = resolvePagination(query, 50);
  const enrollmentWhere: Prisma.EnrollmentWhereInput = {
    classId,
    status: { in: [EnrollmentStatus.ACTIVE, EnrollmentStatus.COMPLETED] },
  };
  const statusFilter = buildTrackerStudentSubmissionFilter(assignmentId, query?.status);

  const [totalAll, filteredTotal, pagedGroups, groupedStatuses] = await Promise.all([
    db.user.count({
      where: { enrollments: { some: enrollmentWhere } },
    }),
    statusFilter
      ? db.user.count({
          where: { enrollments: { some: enrollmentWhere }, ...statusFilter },
        })
      : Promise.resolve<number | null>(null),
    db.enrollment.groupBy({
      by: ['studentId'],
      where: statusFilter ? { ...enrollmentWhere, student: statusFilter } : enrollmentWhere,
      _min: { enrolledDate: true, id: true },
      orderBy: [{ _min: { enrolledDate: 'asc' } }, { _min: { id: 'asc' } }],
      skip,
      take: limit,
    }),
    db.submission.groupBy({
      by: ['status'],
      where: {
        classAssignmentId: assignmentId,
        status: { not: SubmissionStatus.SUPERSEDED },
        student: {
          enrollments: {
            some: enrollmentWhere,
          },
        },
      },
      _count: { _all: true },
    }),
  ]);

  const total = filteredTotal ?? totalAll;
  const stats = aggregateAssignmentStats(
    totalAll,
    groupedStatuses.map((row) => ({ status: row.status, count: row._count._all })),
  );
  const pagedStudentIds = pagedGroups.map((group) => group.studentId);

  if (pagedStudentIds.length === 0) {
    return { students: [], stats, total, page, limit };
  }

  const [pagedUsers, submissions] = await Promise.all([
    db.user.findMany({
      where: { id: { in: pagedStudentIds } },
      select: { id: true, fullName: true, email: true },
    }),
    db.submission.findMany({
      where: {
        classAssignmentId: assignmentId,
        studentId: { in: pagedStudentIds },
      },
      orderBy: { attemptNumber: 'asc' },
      include: {
        answers: { select: { answerPayload: true } },
        reopenLogs: { select: { reason: true, reopenedAt: true }, orderBy: { reopenedAt: 'asc' } },
      },
    }),
  ]);

  const userById = new Map(pagedUsers.map((user) => [user.id, user]));
  const byStudent = new Map<string, typeof submissions>();
  for (const sub of submissions) {
    const bucket = byStudent.get(sub.studentId) ?? [];
    bucket.push(sub);
    byStudent.set(sub.studentId, bucket);
  }

  const students = pagedStudentIds.flatMap((studentId) => {
    const student = userById.get(studentId);
    if (!student) {
      return [];
    }
    const rows = byStudent.get(studentId) ?? [];
    const active = rows.find((r) => r.status !== SubmissionStatus.SUPERSEDED) ?? null;
    const superseded = rows.filter((r) => r.status === SubmissionStatus.SUPERSEDED);
    return [toTeacherTrackerStudentRowDto(student, active, superseded, questionCount)];
  });

  return { students, stats, total, page, limit };
}
