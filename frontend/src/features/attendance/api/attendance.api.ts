import { buildQueryString, requestJson } from '@/lib/api-client';
import type { SessionDisplayStatus, SessionStatus, SessionType } from '@/features/schedules/api/schedules.api';

export type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'EXCUSED';

export interface AttendanceAuditItem {
  id: string;
  studentId: string;
  studentName: string;
  previousStatus: AttendanceStatus;
  newStatus: AttendanceStatus;
  previousNote: string | null;
  newNote: string | null;
  reason: string;
  actorId: string;
  actorName: string;
  actorRole: string;
  isAdminOverride: boolean;
  createdAt: string;
}

export interface SessionRosterStudent {
  studentId: string;
  fullName: string;
  email: string;
  phone: string;
  enrollmentStatus: string;
  enrolledDate: string;
  leftDate: string | null;
  status: AttendanceStatus | null;
  note: string | null;
  markedByName: string | null;
  updatedAt: string | null;
}

export interface SessionAttendanceSheet {
  session: {
    id: string;
    classId: string;
    classCode: string;
    courseName: string;
    teacherName: string;
    sessionNumber: number | null;
    type: SessionType;
    sessionDate: string;
    weekdayLabel: string;
    startTime: string;
    endTime: string;
    status: SessionStatus;
    displayStatus: SessionDisplayStatus;
    isMarked: boolean;
    canMarkAttendance: boolean;
    canEditAttendance: boolean;
    isWithinTeacherWindow: boolean;
    teacherEditDeadline: string;
    requiresEditReason: boolean;
    willBeAdminOverride: boolean;
  };
  summary: {
    totalStudents: number;
    presentCount: number;
    absentCount: number;
    excusedCount: number;
    unmarkedCount: number;
  };
  roster: SessionRosterStudent[];
  auditLogs: AttendanceAuditItem[];
}

export interface StudentAttendanceMetrics {
  presentCount: number;
  absentCount: number;
  excusedCount: number;
  totalAbsenceCount: number;
  markedSessionsCount: number;
  attendanceRatePercent: number | null;
  absenceRateOfTotalPercent: number;
  isAt30PercentWarning: boolean;
}

export interface ClassAttendanceMatrix {
  classId: string;
  classCode: string;
  courseName: string;
  totalSessionsTarget: number;
  editedRecordKeys?: string[];
  sessions: Array<{
    id: string;
    sessionNumber: number | null;
    sessionDate: string;
    weekdayLabel: string;
    startTime: string;
    endTime: string;
    status: SessionStatus;
    displayStatus: SessionDisplayStatus;
    isMakeup: boolean;
    isRescheduled: boolean;
  }>;
  students: Array<{
    studentId: string;
    fullName: string;
    email: string;
    enrollmentStatus: string;
    enrolledDate: string;
    leftDate: string | null;
    metrics: StudentAttendanceMetrics;
    recordsBySessionId: Record<string, AttendanceStatus | null>;
  }>;
}

export interface StudentMyAttendance {
  classes: Array<{
    classId: string;
    classCode: string;
    courseName: string;
    enrollmentStatus: string;
  }>;
  activeClass: {
    classId: string;
    classCode: string;
    courseName: string;
    teacherName: string;
    totalSessions: number;
    enrolledDate: string;
    leftDate: string | null;
  } | null;
  metrics: StudentAttendanceMetrics | null;
  warningThresholdPercent: number;
  sessions: Array<{
    id: string;
    sessionNumber: number | null;
    sessionDate: string;
    weekdayLabel: string;
    startTime: string;
    endTime: string;
    status: SessionStatus;
    displayStatus: SessionDisplayStatus;
    isMakeup: boolean;
    isRescheduled: boolean;
    cancelReason: string | null;
    myStatus: AttendanceStatus | null;
    myNote: string | null;
    isWithinEnrollment: boolean;
  }>;
}

export async function getSessionAttendanceSheet(
  sessionId: string,
  signal?: AbortSignal,
): Promise<SessionAttendanceSheet> {
  return requestJson<SessionAttendanceSheet>(`/sessions/${encodeURIComponent(sessionId)}/attendance`, {
    method: 'GET',
    signal,
  });
}

export async function saveSessionAttendance(
  sessionId: string,
  payload: {
    records: Array<{ studentId: string; status: AttendanceStatus; note?: string }>;
    reason?: string;
  },
): Promise<SessionAttendanceSheet> {
  return requestJson<SessionAttendanceSheet>(`/sessions/${encodeURIComponent(sessionId)}/attendance`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function getClassAttendanceMatrix(
  classId: string,
  signal?: AbortSignal,
): Promise<ClassAttendanceMatrix> {
  return requestJson<ClassAttendanceMatrix>(`/classes/${encodeURIComponent(classId)}/attendance/matrix`, {
    method: 'GET',
    signal,
  });
}

export async function getMyAttendance(
  classId?: string,
  signal?: AbortSignal,
): Promise<StudentMyAttendance> {
  const qs = buildQueryString({ classId: classId || undefined });
  return requestJson<StudentMyAttendance>(`/attendance/me${qs}`, {
    method: 'GET',
    signal,
  });
}
