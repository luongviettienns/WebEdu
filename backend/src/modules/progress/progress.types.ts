import type {
  AssessmentType,
  ClassStatus,
  CourseLevel,
  EnrollmentStatus,
  SessionStatus,
  SubmissionStatus,
} from '@prisma/client';
import type { StudentAttendanceMetricsDto } from '../attendance/attendance.types.js';
import type { ClassNextSessionDto } from '../classes/classes.types.js';

export type PassStatus = 'PASSED' | 'FAILED' | 'INSUFFICIENT_DATA';

export interface GradingFormulaDto {
  miniTestWeight: number;
  midtermWeight: number;
  finalWeight: number;
  passingScore: number;
}

export interface HomeworkStatsDto {
  submittedCount: number;
  givenCount: number;
  submissionRatePercent: number | null;
  averageScore10: number | null;
}

export interface StudentAcademicSummaryDto {
  miniTestAvg: number | null;
  miniTestCount: number;
  midtermAvg: number | null;
  midtermCount: number;
  finalAvg: number | null;
  finalCount: number;
  finalScore: number | null;
  passStatus: PassStatus;
  homeworkStats: HomeworkStatsDto;
}

export interface AcademicSubmissionInput {
  status: SubmissionStatus;
  totalScore: number | null;
  submittedAt: Date | null;
}

export interface AcademicAssignmentInput {
  id: string;
  type: AssessmentType;
  maxScore: number;
  isEligible: boolean;
  submissions: ReadonlyArray<AcademicSubmissionInput>;
}

export interface StudentAcademicCalculationInput {
  formula: GradingFormulaDto;
  assignments: ReadonlyArray<AcademicAssignmentInput>;
}

export interface PublishedResultItemDto {
  assignmentId: string;
  submissionId: string;
  title: string;
  type: AssessmentType;
  rawScore: number;
  maxScore: number;
  score10: number;
  returnedAt: string | null;
  dueAt: string;
  teacherFeedback: string | null;
  isOverdueZero: boolean;
}

export interface StudentProgressSelectedClassDto {
  classId: string;
  classCode: string;
  courseName: string;
  courseLevel: CourseLevel;
  teacherName: string;
  status: ClassStatus;
  enrollmentStatus: EnrollmentStatus;
  enrolledDate: string;
  leftDate: string | null;
  expectedEndDate: string | null;
  completedSessionsCount: number;
  totalSessions: number;
  remainingSessionsCount: number;
  progressPercent: number;
  nextSession: ClassNextSessionDto | null;
}

export interface StudentClassHistoryItemDto {
  classId: string;
  classCode: string;
  courseName: string;
  teacherName: string;
  enrollmentStatus: EnrollmentStatus;
  classStatus: ClassStatus;
  enrolledDate: string;
  leftDate: string | null;
  expectedEndDate: string | null;
  completedSessionsCount: number;
  totalSessions: number;
  progressPercent: number;
}

export interface StudentProgressResponseDto {
  selectedClass: StudentProgressSelectedClassDto | null;
  gradingFormula: GradingFormulaDto | null;
  attendance: StudentAttendanceMetricsDto | null;
  academicSummary: StudentAcademicSummaryDto | null;
  publishedResults: PublishedResultItemDto[];
  classHistory: StudentClassHistoryItemDto[];
}

export interface ClassProgressStudentRowDto {
  studentId: string;
  fullName: string;
  email: string;
  enrollmentStatus: EnrollmentStatus;
  presentCount: number;
  absencesCount: number;
  markedSessionsCount: number;
  attendanceRatePercent: number | null;
  isAt30PercentWarning: boolean;
  homeworkSubmittedCount: number;
  homeworkGivenCount: number;
  homeworkSubmissionRatePercent: number | null;
  homeworkAverageScore10: number | null;
  miniTestAvg: number | null;
  midtermAvg: number | null;
  finalAvg: number | null;
  finalScore: number | null;
  passStatus: PassStatus;
  isAtRisk: boolean;
}

export interface ClassProgressSummaryDto {
  classId: string;
  classCode: string;
  courseName: string;
  teacherName: string;
  status: ClassStatus;
  completedSessionsCount: number;
  totalSessions: number;
  remainingSessionsCount: number;
  progressPercent: number;
  expectedEndDate: string | null;
  nextSession: ClassNextSessionDto | null;
}

export interface ClassProgressReportDto {
  classSummary: ClassProgressSummaryDto;
  gradingFormula: GradingFormulaDto;
  students: ClassProgressStudentRowDto[];
}

export interface AdminOverviewSessionDto {
  id: string;
  classId: string;
  classCode: string;
  courseName: string;
  teacherName: string;
  sessionNumber: number | null;
  sessionDate: string;
  weekdayLabel: string;
  startTime: string;
  endTime: string;
  status: SessionStatus;
  isMakeup: boolean;
}

export interface AdminOverviewClassItemDto {
  classId: string;
  classCode: string;
  courseId: string;
  courseName: string;
  teacherId: string;
  teacherName: string;
  status: ClassStatus;
  enrolledCount: number;
  completedSessionsCount: number;
  totalSessions: number;
  remainingSessionsCount: number;
  progressPercent: number;
  expectedEndDate: string | null;
  nextSession: ClassNextSessionDto | null;
  averageAttendanceRatePercent: number | null;
}

export interface AdminOverviewResponseDto {
  kpis: {
    activeClassesCount: number;
    upcomingClassesCount: number;
    activeStudentsCount: number;
    pendingEnrollmentCount: number;
    todaySessionsCount: number;
  };
  classes: AdminOverviewClassItemDto[];
  todaySessions: AdminOverviewSessionDto[];
  upcomingSessions: AdminOverviewSessionDto[];
  filterOptions: {
    courses: Array<{ id: string; code: string; name: string }>;
    teachers: Array<{ id: string; fullName: string }>;
  };
}
