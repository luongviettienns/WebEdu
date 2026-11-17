import {
  buildQueryString,
  requestJson,
  type RequestOptions,
} from '@/lib/api-client';

import type {
  GradingStatus,
  GradingTrackerFilter,
  AssignmentGradingTrackerDto,
  TeacherSubmissionGradingDetailDto,
  StudentPublishedResultResponseDto,
} from './grading.types';

export type * from './grading.types';

export async function getAssignmentGradingTracker(
  assignmentId: string,
  params: { status: GradingTrackerFilter; page: number },
  options?: RequestOptions,
): Promise<AssignmentGradingTrackerDto> {
  const qs = buildQueryString({ ...params, limit: 50 });
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

export interface AiEssaySuggestionItemDto {
  questionId: string;
  maxPoints: number;
  aiSuggestedPoints: number;
  aiFeedback: string;
  skippedEmpty: boolean;
}

export interface AiGradeSubmissionResultDto {
  submissionId: string;
  gradingStatus: GradingStatus;
  provider: string;
  model: string;
  suggestions: AiEssaySuggestionItemDto[];
}

export interface AiEssayReviewInput {
  prompt: string;
  sampleAnswer: string;
  rubric: string;
  studentAnswer: string;
}

export async function requestAiEssaySuggestion(
  submissionId: string,
  questionId: string,
  reviewedInput: AiEssayReviewInput,
): Promise<AiGradeSubmissionResultDto> {
  return requestJson<AiGradeSubmissionResultDto>(
    `/submissions/${encodeURIComponent(submissionId)}/ai-grade`,
    {
      method: 'POST',
      body: JSON.stringify({ questionId, reviewedInput }),
    },
  );
}

export interface ReviewedAiBatchItemPayload {
  submissionId: string;
  questionId: string;
  reviewedInput: AiEssayReviewInput;
}

export interface AiBatchSuggestGradeResultDto {
  assignmentId: string;
  requestedCount: number;
  succeededCount: number;
  failedCount: number;
  results: Array<{
    submissionId: string;
    ok: boolean;
    gradingStatus?: GradingStatus;
    suggestedCount?: number;
    error?: string;
  }>;
}

export async function requestBatchAiEssaySuggestions(
  assignmentId: string,
  payload: { questionId?: string; reviews: ReviewedAiBatchItemPayload[] },
): Promise<AiBatchSuggestGradeResultDto> {
  return requestJson<AiBatchSuggestGradeResultDto>(
    `/assignments/${encodeURIComponent(assignmentId)}/ai-grade`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  );
}

export async function saveManualGrade(
  submissionId: string,
  payload: {
    teacherFeedback?: string | null;
    previousTeacherFeedback?: string | null;
    answers?: {
      questionId: string;
      earnedPoints?: number;
      previousEarnedPoints?: number | null;
      applyAiSuggestion?: boolean;
      teacherComment?: string | null;
      previousTeacherComment?: string | null;
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

export interface AdjustGradeAnswerPayload {
  questionId: string;
  earnedPoints?: number;
  teacherComment?: string | null;
  previousEarnedPoints?: number | null;
  previousTeacherComment?: string | null;
}

export async function adjustSubmissionGrade(
  submissionId: string,
  payload: {
    reason: string;
    teacherFeedback?: string | null;
    previousTeacherFeedback?: string | null;
    answers?: AdjustGradeAnswerPayload[];
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
