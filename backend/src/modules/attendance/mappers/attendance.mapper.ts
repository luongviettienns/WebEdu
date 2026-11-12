import { AttendanceStatus, EnrollmentStatus, Role, SessionStatus, SessionType } from '@prisma/client';
import {
  calculateTeacherAttendanceDeadline,
  formatDateTimeVn,
  formatIsoDateUtc,
  isVnFutureDate,
  isWithinTeacherAttendanceWindow,
} from '../../../common/utils/timezone.util.js';
import {
  computeSessionDisplayStatus,
  getWeekdayVnLabel,
} from '../../schedules/policies/session-schedule.policy.js';
import type {
  AttendanceAuditItemDto,
  SessionAttendanceSheetDto,
  SessionRosterStudentDto,
} from '../attendance.types.js';

export interface SessionAttendanceSheetEntity {
  id: string;
  classId: string;
  sessionNumber: number | null;
  type: SessionType;
  sessionDate: Date;
  startTime: string;
  endTime: string;
  status: SessionStatus;
  class: {
    id: string;
    code: string;
    status: string;
    teacherId: string;
    course: { name: string };
    teacher: { fullName: string };
  };
  attendanceRecords: Array<{
    studentId: string;
    status: AttendanceStatus;
    note: string | null;
    updatedAt: Date;
    markedBy: { fullName: string };
    updatedBy: { fullName: string } | null;
  }>;
  attendanceAudits: Array<{
    id: string;
    studentId: string;
    previousStatus: AttendanceStatus;
    newStatus: AttendanceStatus;
    previousNote: string | null;
    newNote: string | null;
    reason: string;
    actorId: string;
    actorRole: Role;
    isAdminOverride: boolean;
    createdAt: Date;
    student: { fullName: string };
    actor: { fullName: string };
  }>;
}

export interface SessionRosterEnrollmentEntity {
  studentId: string;
  status: EnrollmentStatus;
  enrolledDate: Date;
  leftDate: Date | null;
  student: { id: string; fullName: string; email: string; phone: string };
}

export function mapSessionAttendanceSheet(
  session: SessionAttendanceSheetEntity,
  enrollments: ReadonlyArray<SessionRosterEnrollmentEntity>,
  viewer: { isAdmin: boolean; isLeadTeacher: boolean; isClosedClass: boolean },
  now: Date = new Date(),
): SessionAttendanceSheetDto {
  const recordMap = new Map(session.attendanceRecords.map((r) => [r.studentId, r]));
  const isCancelled = session.status === SessionStatus.CANCELLED;
  const isFuture = isVnFutureDate(session.sessionDate, now);
  const isWithinWindow = isWithinTeacherAttendanceWindow(session.sessionDate, now);
  const isMarked = session.status === SessionStatus.COMPLETED || session.attendanceRecords.length > 0;

  const canMarkAttendance =
    !viewer.isClosedClass && !isCancelled && !isFuture && !isMarked && (viewer.isAdmin || viewer.isLeadTeacher);
  const canEditAttendance =
    !viewer.isClosedClass &&
    !isCancelled &&
    !isFuture &&
    isMarked &&
    (viewer.isAdmin || (viewer.isLeadTeacher && isWithinWindow));

  const roster: SessionRosterStudentDto[] = enrollments.map((e) => {
    const rec = recordMap.get(e.studentId);
    return {
      studentId: e.studentId,
      fullName: e.student.fullName,
      email: e.student.email,
      phone: e.student.phone,
      enrollmentStatus: e.status,
      enrolledDate: formatIsoDateUtc(e.enrolledDate),
      leftDate: e.leftDate ? formatIsoDateUtc(e.leftDate) : null,
      status: rec?.status ?? null,
      note: rec?.note ?? null,
      markedByName: rec ? (rec.updatedBy?.fullName ?? rec.markedBy.fullName) : null,
      updatedAt: rec ? formatDateTimeVn(rec.updatedAt) : null,
    };
  });

  let presentCount = 0;
  let absentCount = 0;
  let excusedCount = 0;
  let unmarkedCount = 0;
  for (const row of roster) {
    if (row.status === AttendanceStatus.PRESENT) presentCount += 1;
    else if (row.status === AttendanceStatus.ABSENT) absentCount += 1;
    else if (row.status === AttendanceStatus.EXCUSED) excusedCount += 1;
    else unmarkedCount += 1;
  }

  const auditLogs: AttendanceAuditItemDto[] = session.attendanceAudits.map((a) => ({
    id: a.id,
    studentId: a.studentId,
    studentName: a.student.fullName,
    previousStatus: a.previousStatus,
    newStatus: a.newStatus,
    previousNote: a.previousNote,
    newNote: a.newNote,
    reason: a.reason,
    actorId: a.actorId,
    actorName: a.actor.fullName,
    actorRole: a.actorRole,
    isAdminOverride: a.isAdminOverride,
    createdAt: formatDateTimeVn(a.createdAt),
  }));

  return {
    session: {
      id: session.id,
      classId: session.classId,
      classCode: session.class.code,
      courseName: session.class.course.name,
      teacherName: session.class.teacher.fullName,
      sessionNumber: session.sessionNumber,
      type: session.type,
      sessionDate: formatIsoDateUtc(session.sessionDate),
      weekdayLabel: getWeekdayVnLabel(session.sessionDate),
      startTime: session.startTime,
      endTime: session.endTime,
      status: session.status,
      displayStatus: computeSessionDisplayStatus(session.status, session.sessionDate, now),
      isMarked,
      canMarkAttendance,
      canEditAttendance,
      isWithinTeacherWindow: isWithinWindow,
      teacherEditDeadline: formatDateTimeVn(calculateTeacherAttendanceDeadline(session.sessionDate)),
      requiresEditReason: isMarked,
      willBeAdminOverride: isMarked && viewer.isAdmin && !isWithinWindow,
    },
    summary: {
      totalStudents: roster.length,
      presentCount,
      absentCount,
      excusedCount,
      unmarkedCount,
    },
    roster,
    auditLogs,
  };
}
