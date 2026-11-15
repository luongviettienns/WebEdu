import {
  buildQueryString,
  requestJson,
  type RequestOptions,
} from '@/lib/api-client';
import type {
  AssessmentType,
  QuestionType,
} from '@/features/assessments/api/assessments.api';
import type {
  AssignmentDisplayStatus,
  SubmissionStatus,
} from '@/features/assignments/api/assignments.api';

export type GradingStatus =
  | 'UNGRADED'
  | 'AUTO_GRADED'
  | 'AI_DRAFTED'
  | 'GRADED';

export type GradingTrackerFilter =
  | 'ALL'
  | 'NEEDS_GRADING'
  | 'CONFIRMED'
  | 'PUBLISHED'
  | 'OVERDUE_NOT_SUBMITTED';

export interface GradingTrackerSummaryDto {
  totalStudents: number;
  notStartedCount: number;
  overdueNotSubmittedCount: number;
  inProgressCount: number;
  submittedWaitingCount: number;
  autoGradedPendingReviewCount: number;
  gradedConfirmedCount: number;
  returnedPublishedCount: number;
  readyToPublishCount: number;
}

export interface GradingTrackerStudentRowDto {
  studentId: string;
  fullName: string;
  email: string;
  submissionId: string | null;
  attemptNumber: number;
  status: AssignmentDisplayStatus;
  displayStatusLabel: string;
  gradingStatus: GradingStatus | null;
  isOverdueNotSubmitted: boolean;
  isLateSubmission: boolean;
  effectiveDueAt: string;
  submittedAt: string | null;
  autoSubmitted: boolean;
  autoScore: number | null;
  totalScore: number | null;
  ungradedSubjectiveCount: number;
  hasAiDraft: boolean;
  gradeUpdatedAt: string | null;
  canGrade: boolean;
  canAdjustGrade: boolean;
  canConfirm: boolean;
  canPublish: boolean;
  canRecordOverdueZero: boolean;
}

export interface GradingTrackerAssignmentDto {
  id: string;
  assessmentId: string;
  assessmentTitle: string;
  assessmentType: AssessmentType;
  classId: string;
  classCode: string;
  className: string;
  dueAt: string;
  totalPoints: number;
  questionCount: number;
  hasSubjectiveQuestions: boolean;
}

export interface AssignmentGradingTrackerDto {
  assignment: GradingTrackerAssignmentDto;
  summary: GradingTrackerSummaryDto;
  students: GradingTrackerStudentRowDto[];
  total: number;
  page: number;
  limit: number;
}

export interface GradeAuditLogItemDto {
  id: string;
  answerId: string | null;
  questionId: string | null;
  questionPosition: number | null;
  actorId: string;
  actorName: string;
  oldScore: number;
  newScore: number;
  reason: string;
  createdAt: string;
}

export interface TeacherGradingQuestionDetailDto {
  questionId: string;
  position: number;
  type: QuestionType;
  prompt: string;
  points: number;
  isObjective: boolean;
  questionPayload: Record<string, unknown>;
  studentAnswer: {
    answerId: string | null;
    answerPayload: Record<string, unknown>;
    audioPlayCount: number;
    isCorrect: boolean | null;
    earnedPoints: number | null;
    aiSuggestedPoints: number | null;
    aiFeedback: string | null;
    teacherComment: string | null;
    teacherEdited: boolean;
  };
}

export interface TeacherSubmissionGradingDetailDto {
  submission: {
    id: string;
    classAssignmentId: string;
    attemptNumber: number;
    status: SubmissionStatus;
    displayStatusLabel: string;
    gradingStatus: GradingStatus;
    startedAt: string;
    submittedAt: string | null;
    autoSubmitted: boolean;
    autoScore: number | null;
    totalScore: number | null;
    teacherFeedback: string | null;
    gradedAt: string | null;
    gradedByName: string | null;
    returnedAt: string | null;
    gradeUpdatedAt: string | null;
    isLateSubmission: boolean;
    hasSubjectiveQuestions: boolean;
    ungradedSubjectiveCount: number;
  };
  assignment: GradingTrackerAssignmentDto;
  student: { id: string; fullName: string; email: string };
  questions: TeacherGradingQuestionDetailDto[];
  auditLogs: GradeAuditLogItemDto[];
  navigation: { prevSubmissionId: string | null; nextSubmissionId: string | null };
}

export interface StudentPublishedQuestionResultDto {
  questionId: string;
  position: number;
  type: QuestionType;
  prompt: string;
  points: number;
  isObjective: boolean;
  studentAnswer: {
    answerPayload: Record<string, unknown>;
    isCorrect: boolean | null;
    earnedPoints: number | null;
    teacherComment: string | null;
  };
  correctAnswer: Record<string, unknown> | null;
  explanation: string | null;
}

export interface StudentPublishedResultResponseDto {
  assignmentId: string;
  assessmentTitle: string;
  classCode: string;
  className: string;
  dueAt: string;
  isPublished: boolean;
  status: AssignmentDisplayStatus;
  displayStatusLabel: string;
  message: string | null;
  result: {
    submissionId: string;
    attemptNumber: number;
    submittedAt: string | null;
    returnedAt: string | null;
    gradeUpdatedAt: string | null;
    autoSubmitted: boolean;
    autoScore: number | null;
    totalScore: number | null;
    maxScore: number;
    teacherFeedback: string | null;
    questions: StudentPublishedQuestionResultDto[];
  } | null;
}

export async function getAssignmentGradingTracker(
  assignmentId: string,
  status: GradingTrackerFilter = 'ALL',
  options?: RequestOptions,
): Promise<AssignmentGradingTrackerDto> {
  const qs = buildQueryString({ status, limit: 100 });
  return requestJson<AssignmentGradingTrackerDto>(
    `/assignments/${encodeURIComponent(assignmentId)}/grading-tracker${qs}`,
    { method: 'GET', signal: options?.signal },
  );
}

export async function getSubmissionGradingDetail(
  submissionId: string,
  options?: RequestOptions,
): Promise<TeacherSubmissionGradingDetailDto> {
  return requestJson<TeacherSubmissionGradingDetailDto>(
    `/submissions/${encodeURIComponent(submissionId)}/grading-detail`,
    { method: 'GET', signal: options?.signal },
  );
}

export async function requestAiEssaySuggestion(
  submissionId: string,
  questionId?: string,
): Promise<{ provider: string; model: string; suggestions: unknown[] }> {
  return requestJson(`/submissions/${encodeURIComponent(submissionId)}/ai-grade`, {
    method: 'POST',
    body: JSON.stringify(questionId ? { questionId } : {}),
  });
}

export async function saveManualGrade(
  submissionId: string,
  payload: {
    teacherFeedback?: string | null;
    answers?: {
      questionId: string;
      earnedPoints?: number;
      applyAiSuggestion?: boolean;
      teacherComment?: string | null;
    }[];
  },
): Promise<{ totalScore: number | null; readyToConfirm: boolean }> {
  return requestJson(`/submissions/${encodeURIComponent(submissionId)}/manual-grade`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function confirmSubmissionGrade(submissionId: string): Promise<void> {
  await requestJson(`/submissions/${encodeURIComponent(submissionId)}/confirm-grade`, {
    method: 'POST',
  });
}

export async function confirmAllGradedSubmissions(
  assignmentId: string,
  submissionIds?: string[],
): Promise<{ confirmedCount: number; skippedUngradedIds: string[] }> {
  return requestJson(`/assignments/${encodeURIComponent(assignmentId)}/confirm-grades`, {
    method: 'POST',
    body: JSON.stringify(submissionIds ? { submissionIds } : {}),
  });
}

export async function publishConfirmedGrades(
  assignmentId: string,
  submissionIds?: string[],
): Promise<{ publishedCount: number; overdueUntouchedCount: number }> {
  return requestJson(`/assignments/${encodeURIComponent(assignmentId)}/publish-grades`, {
    method: 'POST',
    body: JSON.stringify(submissionIds ? { submissionIds } : {}),
  });
}

export async function recordOverdueZero(
  assignmentId: string,
  payload: { studentIds?: string[]; reason?: string },
): Promise<{ recordedCount: number }> {
  return requestJson(`/assignments/${encodeURIComponent(assignmentId)}/overdue-zero`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function adjustSubmissionGrade(
  submissionId: string,
  payload: {
    reason: string;
    teacherFeedback?: string | null;
    answers?: { questionId: string; earnedPoints: number; teacherComment?: string | null }[];
  },
): Promise<{ totalScore: number; gradeUpdatedAt: string | null }> {
  return requestJson(`/submissions/${encodeURIComponent(submissionId)}/adjust-grade`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function getStudentPublishedResult(
  assignmentId: string,
  options?: RequestOptions,
): Promise<StudentPublishedResultResponseDto> {
  return requestJson<StudentPublishedResultResponseDto>(
    `/assignments/${encodeURIComponent(assignmentId)}/published-result`,
    { method: 'GET', signal: options?.signal },
  );
}
