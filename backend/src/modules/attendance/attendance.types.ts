import type { AttendanceStatus, EnrollmentStatus, Role, SessionStatus, SessionType } from '@prisma/client';
import type { SessionDisplayStatus } from '../schedules/schedules.types.js';

export interface AttendanceAuditItemDto {
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
  actorRole: Role;
  isAdminOverride: boolean;
  createdAt: string;
}

export interface SessionRosterStudentDto {
  studentId: string;
  fullName: string;
  email: string;
  phone: string;
  enrollmentStatus: EnrollmentStatus;
  enrolledDate: string;
  leftDate: string | null;
  status: AttendanceStatus | null;
  note: string | null;
  markedByName: string | null;
  updatedAt: string | null;
}

export interface SessionAttendanceSheetDto {
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
  roster: SessionRosterStudentDto[];
  auditLogs: AttendanceAuditItemDto[];
}

export interface StudentAttendanceMetricsDto {
  presentCount: number;
  absentCount: number;
  excusedCount: number;
  totalAbsenceCount: number;
  markedSessionsCount: number;
  attendanceRatePercent: number | null;
  absenceRateOfTotalPercent: number;
  isAt30PercentWarning: boolean;
}

export interface ClassAttendanceMatrixStudentRowDto {
  studentId: string;
  fullName: string;
  email: string;
  enrollmentStatus: EnrollmentStatus;
  enrolledDate: string;
  leftDate: string | null;
  metrics: StudentAttendanceMetricsDto;
  recordsBySessionId: Record<string, AttendanceStatus | null>;
}

export interface ClassAttendanceMatrixDto {
  classId: string;
  classCode: string;
  courseName: string;
  totalSessionsTarget: number;
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
  students: ClassAttendanceMatrixStudentRowDto[];
  editedRecordKeys: string[];
}

export interface StudentMyAttendanceDto {
  classes: Array<{
    classId: string;
    classCode: string;
    courseName: string;
    enrollmentStatus: EnrollmentStatus;
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
  metrics: StudentAttendanceMetricsDto | null;
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
