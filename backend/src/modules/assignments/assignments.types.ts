import type { AssessmentType, QuestionType, SubmissionStatus } from '@prisma/client';

export type AssignmentDisplayStatus = 'NOT_STARTED' | SubmissionStatus;

export interface OptionAnswerPayload {
  selectedOptionIds: string[];
}

export interface TextAnswerPayload {
  text: string;
}

export interface OrderingAnswerPayload {
  orderedTokens: string[];
}

export type EmptyAnswerPayload = Record<string, never>;

export type StudentAnswerPayload =
  | OptionAnswerPayload
  | TextAnswerPayload
  | OrderingAnswerPayload
  | EmptyAnswerPayload;

export interface ClassAssignmentStatsDto {
  totalStudents: number;
  notStartedCount: number;
  inProgressCount: number;
  submittedWaitingCount: number;
  gradedCount: number;
}

export interface ClassAssignmentSummaryDto {
  id: string;
  assessmentId: string;
  assessmentTitle: string;
  assessmentType: AssessmentType;
  description: string;
  courseId: string;
  classId: string;
  classCode: string;
  className: string;
  sessionId: string | null;
  assignedById: string;
  assignedByName: string;
  assignedAt: string;
  dueAt: string;
  effectiveDurationMinutes: number | null;
  instructions: string | null;
  questionCount: number;
  totalPoints: number;
  stats?: ClassAssignmentStatsDto;
}

export interface StudentAssignmentListItemDto {
  assignmentId: string;
  assessmentId: string;
  assessmentTitle: string;
  assessmentType: AssessmentType;
  classId: string;
  classCode: string;
  className: string;
  assignedAt: string;
  dueAt: string;
  effectiveDurationMinutes: number | null;
  instructions: string | null;
  questionCount: number;
  totalPoints: number;
  isOverdue: boolean;
  submissionId: string | null;
  attemptNumber: number;
  status: AssignmentDisplayStatus;
  displayStatusLabel: string;
  remainingSeconds: number | null;
  elapsedSeconds: number;
  answeredCount: number;
  lastSavedAt: string | null;
  submittedAt: string | null;
  autoSubmitted: boolean;
  autoScore: number | null;
  totalScore: number | null;
  teacherFeedback: string | null;
}

export interface SanitizedOptionDto {
  id: string;
  text: string;
  imageMediaId?: string;
}

export interface SanitizedQuestionDto {
  id: string;
  position: number;
  type: QuestionType;
  prompt: string;
  points: number;
  options?: SanitizedOptionDto[];
  tokens?: string[];
  maxLength?: number;
  mediaId?: string;
  maxListens?: number;
  caption?: string;
  multiple?: boolean;
}

export interface StudentSubmissionAnswerDto {
  questionId: string;
  answerPayload: StudentAnswerPayload;
  audioPlayCount: number;
  updatedAt: string;
}

export interface StudentExamSessionDto {
  assignment: StudentAssignmentListItemDto;
  submission: {
    id: string;
    attemptNumber: number;
    status: SubmissionStatus;
    displayStatusLabel: string;
    startedAt: string;
    lastSavedAt: string;
    lastSyncedAt: string;
    elapsedSeconds: number;
    remainingSeconds: number | null;
    submittedAt: string | null;
    autoSubmitted: boolean;
    reopenReason: string | null;
  };
  questions: SanitizedQuestionDto[];
  answers: StudentSubmissionAnswerDto[];
}

export interface SupersededAttemptDto {
  submissionId: string;
  attemptNumber: number;
  submittedAt: string | null;
  reopenedAt: string | null;
  reopenReason: string | null;
}

export interface TeacherTrackerStudentRowDto {
  studentId: string;
  fullName: string;
  email: string;
  submissionId: string | null;
  attemptNumber: number;
  status: AssignmentDisplayStatus;
  displayStatusLabel: string;
  answeredCount: number;
  questionCount: number;
  startedAt: string | null;
  lastSavedAt: string | null;
  submittedAt: string | null;
  autoSubmitted: boolean;
  elapsedSeconds: number;
  remainingSeconds: number | null;
  canReopen: boolean;
  reopenCount: number;
  supersededAttempts: SupersededAttemptDto[];
}

export interface TeacherAssignmentSubmissionsDto {
  assignment: ClassAssignmentSummaryDto;
  students: TeacherTrackerStudentRowDto[];
}
