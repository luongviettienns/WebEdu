import { buildQueryString, requestJson } from '@/lib/api-client';

export type SessionType = 'REGULAR' | 'MANUAL' | 'MAKEUP';
export type SessionStatus = 'SCHEDULED' | 'COMPLETED' | 'CANCELLED';
export type SessionDisplayStatus =
  | 'SCHEDULED'
  | 'TODAY'
  | 'MISSED_ATTENDANCE'
  | 'COMPLETED'
  | 'CANCELLED';
export type SessionChangeAction =
  | 'GENERATE'
  | 'UPDATE_RECURRING_RULE'
  | 'ADD_MANUAL'
  | 'RESCHEDULE'
  | 'CANCEL'
  | 'ADD_MAKEUP';

export interface LessonSessionAttendanceSummary {
  presentCount: number;
  absentCount: number;
  excusedCount: number;
  totalMarkedCount: number;
}

export interface LessonSessionItem {
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
  makeupForSession: {
    id: string;
    sessionDate: string;
    startTime: string;
    endTime: string;
    cancelReason: string | null;
  } | null;
  hasMakeupReplacement: boolean;
  makeupReplacementId: string | null;
  topic: string | null;
  cancelReason: string | null;
  cancelledAt: string | null;
  attendanceMarkedAt: string | null;
  attendanceSummary: LessonSessionAttendanceSummary | null;
  previousScheduleText: string | null;
  canMarkAttendance: boolean;
  canEditAttendance: boolean;
  canMutateSchedule: boolean;
  myAttendanceStatus?: 'PRESENT' | 'ABSENT' | 'EXCUSED' | null;
  myAttendanceNote?: string | null;
}

export interface ClassSessionsResponse {
  classId: string;
  classCode: string;
  classStatus: string;
  effectiveRole: 'ADMIN' | 'TEACHER' | 'STUDENT';
  summary: {
    totalSessionsTarget: number;
    activeSessionsCount: number;
    completedCount: number;
    missedAttendanceCount: number;
    upcomingCount: number;
    cancelledCount: number;
  };
  sessions: LessonSessionItem[];
}

export interface CalendarSessionsResponse {
  effectiveRole: 'ADMIN' | 'TEACHER' | 'STUDENT';
  from: string;
  to: string;
  items: LessonSessionItem[];
}

export interface SessionMutationResult {
  session: LessonSessionItem;
  expectedEndDate: string | null;
  scheduleConflictWarning: string | null;
}

export interface SessionChangeLogItem {
  id: string;
  classId: string;
  classCode: string;
  sessionId: string | null;
  sessionNumber: number | null;
  action: SessionChangeAction;
  actionLabel: string;
  actorId: string;
  actorName: string;
  previousText: string | null;
  newText: string | null;
  reason: string;
  createdAt: string;
}

export interface SessionChangeLogListResponse {
  items: SessionChangeLogItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export async function listCalendarSessions(
  params: { from: string; to: string; classId?: string; teacherId?: string; status?: SessionStatus },
  signal?: AbortSignal,
): Promise<CalendarSessionsResponse> {
  const qs = buildQueryString({
    from: params.from,
    to: params.to,
    classId: params.classId || undefined,
    teacherId: params.teacherId || undefined,
    status: params.status || undefined,
  });
  return requestJson<CalendarSessionsResponse>(`/schedules/calendar${qs}`, { method: 'GET', signal });
}

export async function listClassSessions(
  classId: string,
  params?: { status?: SessionStatus; from?: string; to?: string },
  signal?: AbortSignal,
): Promise<ClassSessionsResponse> {
  const qs = buildQueryString({
    status: params?.status || undefined,
    from: params?.from || undefined,
    to: params?.to || undefined,
  });
  return requestJson<ClassSessionsResponse>(`/classes/${encodeURIComponent(classId)}/sessions${qs}`, {
    method: 'GET',
    signal,
  });
}

export async function addManualSession(
  classId: string,
  payload: { sessionDate: string; startTime: string; endTime: string; topic?: string; reason?: string },
): Promise<SessionMutationResult> {
  return requestJson<SessionMutationResult>(`/classes/${encodeURIComponent(classId)}/sessions`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function rescheduleSession(
  sessionId: string,
  payload: { sessionDate: string; startTime: string; endTime: string; reason: string; topic?: string },
): Promise<SessionMutationResult> {
  return requestJson<SessionMutationResult>(`/sessions/${encodeURIComponent(sessionId)}/reschedule`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function cancelSession(
  sessionId: string,
  payload: {
    reason: string;
    makeup?: { sessionDate: string; startTime: string; endTime: string; topic?: string };
  },
): Promise<SessionMutationResult> {
  return requestJson<SessionMutationResult>(`/sessions/${encodeURIComponent(sessionId)}/cancel`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function createMakeupSession(
  cancelledSessionId: string,
  payload: { sessionDate: string; startTime: string; endTime: string; topic?: string; reason?: string },
): Promise<SessionMutationResult> {
  return requestJson<SessionMutationResult>(`/sessions/${encodeURIComponent(cancelledSessionId)}/makeup`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function listScheduleChangeLogs(
  params?: {
    classId?: string;
    action?: SessionChangeAction;
    from?: string;
    to?: string;
    page?: number;
    limit?: number;
  },
  signal?: AbortSignal,
): Promise<SessionChangeLogListResponse> {
  const qs = buildQueryString({
    classId: params?.classId || undefined,
    action: params?.action || undefined,
    from: params?.from || undefined,
    to: params?.to || undefined,
    page: params?.page,
    limit: params?.limit,
  });
  return requestJson<SessionChangeLogListResponse>(`/schedules/change-logs${qs}`, {
    method: 'GET',
    signal,
  });
}
