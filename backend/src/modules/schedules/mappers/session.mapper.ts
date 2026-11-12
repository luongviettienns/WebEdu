import {
  AttendanceStatus,
  ClassStatus,
  Role,
  SessionChangeAction,
  SessionStatus,
  SessionType,
} from '@prisma/client';
import type { AuthenticatedUser } from '../../../common/auth/auth.types.js';
import {
  formatDateTimeVn,
  formatDateVn,
  formatIsoDateUtc,
  isWithinTeacherAttendanceWindow,
  resolveVnToday,
} from '../../../common/utils/timezone.util.js';
import { getWeekdayVnLabel, computeSessionDisplayStatus } from '../policies/session-schedule.policy.js';
import type { LessonSessionItemDto, SessionChangeLogItemDto } from '../schedules.types.js';

export interface LessonSessionEntity {
  id: string;
  classId: string;
  sessionNumber: number | null;
  type: SessionType;
  sessionDate: Date;
  startTime: string;
  endTime: string;
  status: SessionStatus;
  isRescheduled: boolean;
  isMakeup: boolean;
  makeupForSessionId: string | null;
  topic: string | null;
  cancelReason: string | null;
  cancelledAt: Date | null;
  attendanceMarkedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  class: {
    id: string;
    code: string;
    status: ClassStatus;
    teacherId: string;
    course: { name: string };
    teacher: { id: string; fullName: string };
  };
  makeupForSession: {
    id: string;
    sessionDate: Date;
    startTime: string;
    endTime: string;
    cancelReason: string | null;
  } | null;
  makeupReplacement: { id: string } | null;
  attendanceRecords?: Array<{
    studentId: string;
    status: AttendanceStatus;
    note: string | null;
  }>;
  changeLogs?: Array<{
    action: SessionChangeAction;
    previousDate: Date | null;
    previousStartTime: string | null;
    previousEndTime: string | null;
  }>;
}

export interface SessionChangeLogEntity {
  id: string;
  classId: string;
  sessionId: string | null;
  action: SessionChangeAction;
  actorId: string;
  actorName: string;
  previousDate: Date | null;
  previousStartTime: string | null;
  previousEndTime: string | null;
  newDate: Date | null;
  newStartTime: string | null;
  newEndTime: string | null;
  reason: string;
  createdAt: Date;
  class: { code: string };
  session: { sessionNumber: number | null } | null;
}

const ACTION_LABELS: Record<SessionChangeAction, string> = {
  GENERATE: 'Khởi tạo lịch định kỳ',
  UPDATE_RECURRING_RULE: 'Sửa lịch định kỳ',
  ADD_MANUAL: 'Thêm buổi thủ công',
  RESCHEDULE: 'Đổi lịch buổi',
  CANCEL: 'Hủy buổi học',
  ADD_MAKEUP: 'Tạo buổi học bù',
};

function formatSlotText(date: Date | null, start: string | null, end: string | null): string | null {
  if (!date) return null;
  const wd = getWeekdayVnLabel(date);
  const ddmm = formatDateVn(date).slice(0, 5);
  return start && end ? `${wd} ${ddmm} ${start}–${end}` : `${wd} ${ddmm}`;
}

export function toLessonSessionItemDto(
  entity: LessonSessionEntity,
  actor: AuthenticatedUser,
  effectiveRole: 'ADMIN' | 'TEACHER' | 'STUDENT',
  nowInstant: Date = new Date(),
): LessonSessionItemDto {
  const displayStatus = computeSessionDisplayStatus(entity.status, entity.sessionDate, nowInstant);
  const todayYmd = formatIsoDateUtc(resolveVnToday(nowInstant));
  const sessionYmd = formatIsoDateUtc(entity.sessionDate);
  const isClosedClass =
    entity.class.status === ClassStatus.COMPLETED || entity.class.status === ClassStatus.ARCHIVED;

  const isAdmin = effectiveRole === 'ADMIN' || actor.roles.includes(Role.ADMIN);
  const isLeadTeacher = effectiveRole === 'TEACHER' && entity.class.teacherId === actor.id;
  const isCancelled = entity.status === SessionStatus.CANCELLED;
  const isFutureDate = sessionYmd > todayYmd;

  const canMarkAttendance =
    !isClosedClass &&
    !isCancelled &&
    !isFutureDate &&
    entity.status === SessionStatus.SCHEDULED &&
    (entity.attendanceRecords?.length ?? 0) === 0 &&
    (isAdmin || isLeadTeacher);

  const canEditAttendance =
    !isClosedClass &&
    entity.status === SessionStatus.COMPLETED &&
    (isAdmin || (isLeadTeacher && isWithinTeacherAttendanceWindow(entity.sessionDate, nowInstant)));

  const canMutateSchedule = !isClosedClass && isAdmin && entity.status === SessionStatus.SCHEDULED;

  const records = entity.attendanceRecords ?? [];
  let attendanceSummary: LessonSessionItemDto['attendanceSummary'] = null;
  if (entity.status === SessionStatus.COMPLETED && effectiveRole !== 'STUDENT') {
    let presentCount = 0;
    let absentCount = 0;
    let excusedCount = 0;
    for (const r of records) {
      if (r.status === AttendanceStatus.PRESENT) presentCount += 1;
      else if (r.status === AttendanceStatus.ABSENT) absentCount += 1;
      else if (r.status === AttendanceStatus.EXCUSED) excusedCount += 1;
    }
    attendanceSummary = {
      presentCount,
      absentCount,
      excusedCount,
      totalMarkedCount: records.length,
    };
  }

  const latestReschedule = entity.changeLogs?.find((l) => l.action === SessionChangeAction.RESCHEDULE);
  const previousScheduleText = latestReschedule
    ? formatSlotText(
        latestReschedule.previousDate,
        latestReschedule.previousStartTime,
        latestReschedule.previousEndTime,
      )
    : null;

  const myRecord =
    effectiveRole === 'STUDENT' ? records.find((r) => r.studentId === actor.id) : undefined;

  return {
    id: entity.id,
    classId: entity.classId,
    classCode: entity.class.code,
    courseName: entity.class.course.name,
    teacherId: entity.class.teacher.id,
    teacherName: entity.class.teacher.fullName,
    sessionNumber: entity.sessionNumber,
    type: entity.type,
    sessionDate: sessionYmd,
    weekdayLabel: getWeekdayVnLabel(entity.sessionDate),
    startTime: entity.startTime,
    endTime: entity.endTime,
    status: entity.status,
    displayStatus,
    isRescheduled: entity.isRescheduled,
    isMakeup: entity.isMakeup,
    makeupForSessionId: entity.makeupForSessionId,
    makeupForSession: entity.makeupForSession
      ? {
          id: entity.makeupForSession.id,
          sessionDate: formatIsoDateUtc(entity.makeupForSession.sessionDate),
          startTime: entity.makeupForSession.startTime,
          endTime: entity.makeupForSession.endTime,
          cancelReason: entity.makeupForSession.cancelReason,
        }
      : null,
    hasMakeupReplacement: entity.makeupReplacement !== null,
    makeupReplacementId: entity.makeupReplacement?.id ?? null,
    topic: entity.topic,
    cancelReason: entity.cancelReason,
    cancelledAt: entity.cancelledAt ? entity.cancelledAt.toISOString() : null,
    attendanceMarkedAt: entity.attendanceMarkedAt ? entity.attendanceMarkedAt.toISOString() : null,
    attendanceSummary,
    previousScheduleText,
    canMarkAttendance,
    canEditAttendance,
    canMutateSchedule,
    ...(effectiveRole === 'STUDENT'
      ? {
          myAttendanceStatus: myRecord?.status ?? null,
          myAttendanceNote: myRecord?.note ?? null,
        }
      : {}),
    createdAt: entity.createdAt.toISOString(),
    updatedAt: entity.updatedAt.toISOString(),
  };
}

export function toSessionChangeLogItemDto(entity: SessionChangeLogEntity): SessionChangeLogItemDto {
  return {
    id: entity.id,
    classId: entity.classId,
    classCode: entity.class.code,
    sessionId: entity.sessionId,
    sessionNumber: entity.session?.sessionNumber ?? null,
    action: entity.action,
    actionLabel: ACTION_LABELS[entity.action] ?? entity.action,
    actorId: entity.actorId,
    actorName: entity.actorName,
    previousDate: entity.previousDate ? formatIsoDateUtc(entity.previousDate) : null,
    previousStartTime: entity.previousStartTime,
    previousEndTime: entity.previousEndTime,
    previousText: formatSlotText(
      entity.previousDate,
      entity.previousStartTime,
      entity.previousEndTime,
    ),
    newDate: entity.newDate ? formatIsoDateUtc(entity.newDate) : null,
    newStartTime: entity.newStartTime,
    newEndTime: entity.newEndTime,
    newText: formatSlotText(entity.newDate, entity.newStartTime, entity.newEndTime),
    reason: entity.reason,
    createdAt: formatDateTimeVn(entity.createdAt),
  };
}
