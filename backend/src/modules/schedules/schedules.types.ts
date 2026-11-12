import type { SessionChangeAction, SessionStatus, SessionType } from '@prisma/client';

/**
 * Computed UI status combining persisted `SessionStatus` and `Asia/Ho_Chi_Minh` calendar date (`DEC-009`).
 * Cancelled stays `CANCELLED`, attended stays `COMPLETED`, past unmarked becomes `MISSED_ATTENDANCE`,
 * today's unmarked becomes `TODAY`, future unmarked stays `SCHEDULED`.
 */
export type SessionDisplayStatus =
  | 'SCHEDULED'
  | 'TODAY'
  | 'MISSED_ATTENDANCE'
  | 'COMPLETED'
  | 'CANCELLED';

export interface LessonSessionAttendanceSummaryDto {
  presentCount: number;
  absentCount: number;
  excusedCount: number;
  totalMarkedCount: number;
}

export interface MakeupSourceSessionDto {
  id: string;
  sessionDate: string;
  startTime: string;
  endTime: string;
  cancelReason: string | null;
}

export interface LessonSessionItemDto {
  id: string;
  classId: string;
  classCode: string;
  courseName: string;
  teacherId: string;
  teacherName: string;
  sessionNumber: number | null;
  type: SessionType;
  sessionDate: string;
  weekdayLabel: string;
  startTime: string;
  endTime: string;
  status: SessionStatus;
  displayStatus: SessionDisplayStatus;
  isRescheduled: boolean;
  isMakeup: boolean;
  makeupForSessionId: string | null;
  makeupForSession: MakeupSourceSessionDto | null;
  hasMakeupReplacement: boolean;
  makeupReplacementId: string | null;
  topic: string | null;
  cancelReason: string | null;
  cancelledAt: string | null;
  attendanceMarkedAt: string | null;
  attendanceSummary: LessonSessionAttendanceSummaryDto | null;
  previousScheduleText: string | null;
  canMarkAttendance: boolean;
  canEditAttendance: boolean;
  canMutateSchedule: boolean;
  /** Applicable when viewer is a STUDENT (`FUNC-035`, `FUNC-036`): personal attendance mark for this session. */
  myAttendanceStatus?: 'PRESENT' | 'ABSENT' | 'EXCUSED' | null;
  myAttendanceNote?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ClassSessionsSummaryDto {
  totalSessionsTarget: number;
  activeSessionsCount: number;
  completedCount: number;
  missedAttendanceCount: number;
  upcomingCount: number;
  cancelledCount: number;
}

export interface ClassSessionsResponseDto {
  classId: string;
  classCode: string;
  classStatus: string;
  effectiveRole: 'ADMIN' | 'TEACHER' | 'STUDENT';
  summary: ClassSessionsSummaryDto;
  sessions: LessonSessionItemDto[];
  scheduleConflictWarning?: string | null;
}

export interface SessionChangeLogItemDto {
  id: string;
  classId: string;
  classCode: string;
  sessionId: string | null;
  sessionNumber: number | null;
  action: SessionChangeAction;
  actionLabel: string;
  actorId: string;
  actorName: string;
  previousDate: string | null;
  previousStartTime: string | null;
  previousEndTime: string | null;
  previousText: string | null;
  newDate: string | null;
  newStartTime: string | null;
  newEndTime: string | null;
  newText: string | null;
  reason: string;
  createdAt: string;
}

export interface SessionChangeLogListResponseDto {
  items: SessionChangeLogItemDto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface SessionMutationResultDto {
  session: LessonSessionItemDto;
  expectedEndDate: string | null;
  scheduleConflictWarning: string | null;
}
