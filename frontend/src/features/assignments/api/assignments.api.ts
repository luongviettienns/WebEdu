import {
  API_BASE_URL,
  requestJson,
  type RequestOptions,
} from '@/lib/api-client';
import type { AssessmentType, QuestionType } from '@/features/assessments/api/assessments.api';
import type { StatusTagTone } from '@/features/common/components/StatusTag';

export type SubmissionStatus =
  | 'IN_PROGRESS'
  | 'SUBMITTED_WAITING'
  | 'AUTO_GRADED_PENDING_REVIEW'
  | 'GRADED'
  | 'RETURNED'
  | 'SUPERSEDED';

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
    studentId: string;
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
    dueAtOverride: string | null;
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
  dueAtOverride: string | null;
  canReopen: boolean;
  reopenCount: number;
  supersededAttempts: SupersededAttemptDto[];
}

export interface TeacherAssignmentSubmissionsDto {
  assignment: ClassAssignmentSummaryDto;
  students: TeacherTrackerStudentRowDto[];
  total: number;
  page: number;
  limit: number;
}

export interface AssignAssessmentPayload {
  classIds: string[];
  dueAt: string;
  instructions?: string;
  sessionId?: string;
}

export interface AutosaveAnswerItemPayload {
  questionId: string;
  answerPayload: StudentAnswerPayload;
  audioPlayCount?: number;
}

export interface AutosavePayload {
  answers: AutosaveAnswerItemPayload[];
  elapsedSeconds: number;
  remainingSeconds?: number | null;
}

export interface SubmitPayload {
  answers?: AutosaveAnswerItemPayload[];
  elapsedSeconds?: number;
  remainingSeconds?: number | null;
  autoSubmitted?: boolean;
}

export interface ReopenSubmissionPayload {
  reason: string;
  newDueAt?: string;
}

export const ASSIGNMENT_DISPLAY_STATUS_LABELS: Record<AssignmentDisplayStatus, string> = {
  NOT_STARTED: 'Chưa làm',
  IN_PROGRESS: 'Đang làm dở',
  SUBMITTED_WAITING: 'Đã nộp - Chờ chấm',
  AUTO_GRADED_PENDING_REVIEW: 'Chờ GV duyệt điểm',
  GRADED: 'Đã chấm',
  RETURNED: 'Đã trả kết quả',
  SUPERSEDED: 'Đã mở lại lượt mới',
};

export function getAssignmentStatusTone(status: AssignmentDisplayStatus): StatusTagTone {
  switch (status) {
    case 'NOT_STARTED':
      return 'amber';
    case 'IN_PROGRESS':
      return 'blue';
    case 'SUBMITTED_WAITING':
    case 'AUTO_GRADED_PENDING_REVIEW':
      return 'amber';
    case 'GRADED':
    case 'RETURNED':
      return 'jade';
    case 'SUPERSEDED':
    default:
      return 'grey';
  }
}

export function isSubmittedAssignmentStatus(status: AssignmentDisplayStatus): boolean {
  return (
    status === 'SUBMITTED_WAITING' ||
    status === 'AUTO_GRADED_PENDING_REVIEW' ||
    status === 'GRADED' ||
    status === 'RETURNED'
  );
}

export function isAnswerPayloadNonEmpty(payload: StudentAnswerPayload | undefined): boolean {
  if (!payload || typeof payload !== 'object') return false;
  if ('selectedOptionIds' in payload && Array.isArray(payload.selectedOptionIds)) {
    return payload.selectedOptionIds.length > 0;
  }
  if ('text' in payload && typeof payload.text === 'string') {
    return payload.text.trim().length > 0;
  }
  if ('orderedTokens' in payload && Array.isArray(payload.orderedTokens)) {
    return payload.orderedTokens.length > 0;
  }
  return false;
}

export async function assignAssessment(
  assessmentId: string,
  payload: AssignAssessmentPayload,
): Promise<{ items: ClassAssignmentSummaryDto[] }> {
  return requestJson<{ items: ClassAssignmentSummaryDto[] }>(
    `/assessments/${encodeURIComponent(assessmentId)}/assign`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  );
}

export async function listClassAssignments(
  classId: string,
  options?: RequestOptions,
): Promise<{ items: ClassAssignmentSummaryDto[] }> {
  return requestJson<{ items: ClassAssignmentSummaryDto[] }>(
    `/classes/${encodeURIComponent(classId)}/assignments`,
    {
      method: 'GET',
      signal: options?.signal,
    },
  );
}

export async function getAssignmentSubmissions(
  assignmentId: string,
  options?: RequestOptions & { page?: number; limit?: number },
): Promise<TeacherAssignmentSubmissionsDto> {
  const query = new URLSearchParams();
  if (options?.page !== undefined) query.set('page', String(options.page));
  if (options?.limit !== undefined) query.set('limit', String(options.limit));
  const qs = query.toString();
  return requestJson<TeacherAssignmentSubmissionsDto>(
    `/assignments/${encodeURIComponent(assignmentId)}/submissions${qs ? `?${qs}` : ''}`,
    {
      method: 'GET',
      signal: options?.signal,
    },
  );
}

export async function reopenSubmission(
  submissionId: string,
  payload: ReopenSubmissionPayload,
): Promise<TeacherTrackerStudentRowDto> {
  return requestJson<TeacherTrackerStudentRowDto>(
    `/submissions/${encodeURIComponent(submissionId)}/reopen`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  );
}

export async function getMyAssignments(
  options?: RequestOptions,
): Promise<{ items: StudentAssignmentListItemDto[] }> {
  return requestJson<{ items: StudentAssignmentListItemDto[] }>('/assignments/me', {
    method: 'GET',
    signal: options?.signal,
  });
}

export async function startOrResumeAssignment(
  assignmentId: string,
  options?: RequestOptions,
): Promise<StudentExamSessionDto> {
  return requestJson<StudentExamSessionDto>(
    `/assignments/${encodeURIComponent(assignmentId)}/submissions/start`,
    {
      method: 'POST',
      signal: options?.signal,
    },
  );
}

export async function autosaveAssignment(
  assignmentId: string,
  payload: AutosavePayload,
): Promise<StudentExamSessionDto> {
  return requestJson<StudentExamSessionDto>(
    `/assignments/${encodeURIComponent(assignmentId)}/submissions/autosave`,
    {
      method: 'PATCH',
      body: JSON.stringify(payload),
    },
  );
}

export async function submitAssignment(
  assignmentId: string,
  payload: SubmitPayload,
): Promise<StudentExamSessionDto> {
  return requestJson<StudentExamSessionDto>(
    `/assignments/${encodeURIComponent(assignmentId)}/submissions/submit`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  );
}

export async function getMySubmittedAssignment(
  assignmentId: string,
  options?: RequestOptions,
): Promise<StudentExamSessionDto> {
  return requestJson<StudentExamSessionDto>(
    `/assignments/${encodeURIComponent(assignmentId)}/submissions/me`,
    {
      method: 'GET',
      signal: options?.signal,
    },
  );
}

export function getAssignmentMediaUrl(assignmentId: string, mediaId: string): string {
  return `${API_BASE_URL}/assignments/${encodeURIComponent(assignmentId)}/media/${encodeURIComponent(mediaId)}`;
}
