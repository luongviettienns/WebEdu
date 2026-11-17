import {
  buildQueryString,
  API_BASE_URL,
  requestJson,
  type RequestOptions,
} from '@/lib/api-client';
import type { StatusTagTone } from '@/features/common/components/StatusTag';

import type {
  AssignmentDisplayStatus,
  StudentAnswerPayload,
  ClassAssignmentSummaryDto,
  StudentAssignmentListItemDto,
  StudentExamSessionDto,
  TeacherAssignmentSubmissionsDto,
  TeacherTrackerStudentRowDto,
  AssignAssessmentPayload,
  AutosavePayload,
  SubmitPayload,
  ReopenSubmissionPayload,
} from './assignments.types';

export type * from './assignments.types';

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
  options?: RequestOptions & { timerClientId?: string },
): Promise<StudentExamSessionDto> {
  return requestJson<StudentExamSessionDto>(
    `/assignments/${encodeURIComponent(assignmentId)}/submissions/start${buildQueryString({ timerClientId: options?.timerClientId })}`,
    {
      method: 'POST',
      signal: options?.signal,
    },
  );
}

export async function autosaveAssignment(
  assignmentId: string,
  payload: AutosavePayload,
  keepalive = false,
): Promise<StudentExamSessionDto> {
  return requestJson<StudentExamSessionDto>(
    `/assignments/${encodeURIComponent(assignmentId)}/submissions/autosave`,
    {
      method: 'PATCH',
      body: JSON.stringify(payload),
      keepalive,
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

export function getAssignmentMediaUrl(assignmentId: string, mediaId: string, questionId?: string): string {
  const questionQuery = questionId ? "?questionId=" + encodeURIComponent(questionId) : "";
  return `${API_BASE_URL}/assignments/${encodeURIComponent(assignmentId)}/media/${encodeURIComponent(mediaId)}${questionQuery}`;
}
