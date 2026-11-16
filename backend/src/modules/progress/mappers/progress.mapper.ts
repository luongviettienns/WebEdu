import {
  AttendanceStatus,
  EnrollmentStatus,
  SessionStatus,
  type AssessmentType,
} from '@prisma/client';
import { formatIsoDateUtc, resolveVnToday } from '../../../common/utils/timezone.util.js';
import type { AttendancePolicy } from '../../attendance/policies/attendance.policy.js';
import type { ClassNextSessionDto } from '../../classes/classes.types.js';
import { toClassNextSessionDto } from '../../classes/policies/class-session-lifecycle.util.js';
import { getWeekdayVnLabel } from '../../schedules/policies/session-schedule.policy.js';
import { normalizeScore10 } from '../policies/grade-calculation.policy.js';
import type {
  AdminOverviewSessionDto,
  GradingFormulaDto,
  PublishedResultItemDto,
} from '../progress.types.js';

export function groupByKey<T>(rows: ReadonlyArray<T>, getKey: (row: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    const key = getKey(row);
    const list = map.get(key);
    if (list) list.push(row);
    else map.set(key, [row]);
  }
  return map;
}

export function selectPrimaryEnrollment<
  T extends { status: EnrollmentStatus; enrolledDate: Date; createdAt?: Date },
>(rows: ReadonlyArray<T>): T {
  const active = rows.find((row) => row.status === EnrollmentStatus.ACTIVE);
  if (active) return active;
  return [...rows].sort((a, b) => {
    const dateDiff = b.enrolledDate.getTime() - a.enrolledDate.getTime();
    if (dateDiff !== 0) return dateDiff;
    return (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0);
  })[0]!;
}

export function toGradingFormulaDto(course: GradingFormulaDto): GradingFormulaDto {
  return {
    miniTestWeight: course.miniTestWeight,
    midtermWeight: course.midtermWeight,
    finalWeight: course.finalWeight,
    passingScore: course.passingScore,
  };
}

export function findNextScheduledFromList(
  sessions: ReadonlyArray<{
    id: string;
    sessionNumber: number | null;
    sessionDate: Date;
    startTime: string;
    endTime: string;
    status: SessionStatus;
    isMakeup: boolean;
  }>,
  nowInstant: Date = new Date(),
): ClassNextSessionDto | null {
  const todayMs = resolveVnToday(nowInstant).getTime();
  const next = sessions.find(
    (s) => s.status === SessionStatus.SCHEDULED && s.sessionDate.getTime() >= todayMs,
  );
  return next ? toClassNextSessionDto(next) : null;
}

export function toPublishedResultItemDto(
  assignment: {
    id: string;
    dueAt: Date;
    assessment: { title: string; type: AssessmentType };
  },
  submission: {
    id: string;
    totalScore: number;
    submittedAt: Date | null;
    returnedAt: Date | null;
    teacherFeedback: string | null;
  },
  maxScore: number,
): PublishedResultItemDto {
  return {
    assignmentId: assignment.id,
    submissionId: submission.id,
    title: assignment.assessment.title,
    type: assignment.assessment.type,
    rawScore: submission.totalScore,
    maxScore,
    score10: normalizeScore10(submission.totalScore, maxScore),
    returnedAt: submission.returnedAt ? submission.returnedAt.toISOString() : null,
    dueAt: assignment.dueAt.toISOString(),
    teacherFeedback: submission.teacherFeedback ?? null,
    isOverdueZero: submission.submittedAt === null,
  };
}

export function sortPublishedResultsNewestFirst(
  items: ReadonlyArray<PublishedResultItemDto>,
): PublishedResultItemDto[] {
  return [...items].sort((a, b) => {
    const aReturned = a.returnedAt ?? '';
    const bReturned = b.returnedAt ?? '';
    const retDiff = bReturned.localeCompare(aReturned);
    if (retDiff !== 0) return retDiff;
    return b.dueAt.localeCompare(a.dueAt);
  });
}

export function toAdminOverviewSessionDto(session: {
  id: string;
  classId: string;
  sessionNumber: number | null;
  sessionDate: Date;
  startTime: string;
  endTime: string;
  status: SessionStatus;
  isMakeup: boolean;
  class: {
    code: string;
    course: { name: string };
    teacher: { fullName: string };
  };
}): AdminOverviewSessionDto {
  return {
    id: session.id,
    classId: session.classId,
    classCode: session.class.code,
    courseName: session.class.course.name,
    teacherName: session.class.teacher.fullName,
    sessionNumber: session.sessionNumber ?? null,
    sessionDate: formatIsoDateUtc(session.sessionDate),
    weekdayLabel: getWeekdayVnLabel(session.sessionDate),
    startTime: session.startTime,
    endTime: session.endTime,
    status: session.status,
    isMakeup: session.isMakeup,
  };
}

export function computeAverageAttendanceRate(
  records: ReadonlyArray<{ sessionId: string; studentId: string; status: AttendanceStatus }>,
  sessionById: ReadonlyMap<string, { status: SessionStatus; sessionDate: Date }>,
  enrollmentsByStudent: ReadonlyMap<string, ReadonlyArray<{ enrolledDate: Date; leftDate: Date | null }>>,
  attendancePolicy: AttendancePolicy,
): number | null {
  let presentCount = 0;
  let markedCount = 0;

  for (const record of records) {
    const session = sessionById.get(record.sessionId);
    if (!session || session.status !== SessionStatus.COMPLETED) continue;

    const studentEnrollments = enrollmentsByStudent.get(record.studentId);
    if (!studentEnrollments || studentEnrollments.length === 0) continue;

    const eligible = studentEnrollments.some((enr) =>
      attendancePolicy.isStudentEligibleForSessionDate(enr, session.sessionDate),
    );
    if (!eligible) continue;

    markedCount += 1;
    if (record.status === AttendanceStatus.PRESENT) {
      presentCount += 1;
    }
  }

  return markedCount > 0 ? Math.round((presentCount / markedCount) * 100) : null;
}
