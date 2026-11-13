import {
  ApiClientError,
  buildQueryString,
  requestJson,
  type ProblemDetails,
  type RequestOptions,
} from '@/lib/api-client';

export type AssessmentType = 'HOMEWORK' | 'MINI_TEST' | 'MIDTERM' | 'FINAL';
export type AssessmentStatus = 'DRAFT' | 'PUBLISHED';
export type QuestionType =
  | 'SINGLE_CHOICE'
  | 'MULTIPLE_CHOICE'
  | 'FILL_BLANK'
  | 'ORDERING'
  | 'ESSAY'
  | 'LISTENING'
  | 'IMAGE_BASED';

export const ASSESSMENT_TYPE_LABELS: Record<AssessmentType, string> = {
  HOMEWORK: 'BTVN',
  MINI_TEST: 'Mini-test',
  MIDTERM: 'Giữa kỳ',
  FINAL: 'Cuối kỳ',
};

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  SINGLE_CHOICE: 'Trắc nghiệm 1 đáp án',
  MULTIPLE_CHOICE: 'Trắc nghiệm nhiều đáp án',
  FILL_BLANK: 'Điền từ',
  ORDERING: 'Sắp xếp',
  ESSAY: 'Tự luận',
  LISTENING: 'Nghe',
  IMAGE_BASED: 'Kèm hình ảnh',
};

export interface TeacherQuestionDto {
  id: string;
  type: QuestionType;
  position: number;
  prompt: string;
  payload: Record<string, unknown>;
  points: number;
  needsReview: boolean;
}

export interface TeacherAssessmentDto {
  id: string;
  title: string;
  description?: string;
  type: AssessmentType;
  courseId: string;
  durationMinutes: number | null;
  status: AssessmentStatus;
  isLocked: boolean;
  originalFileName?: string | null;
  assignedClassCount?: number;
  totalPoints: number;
  questionCount: number;
  createdById: string;
  createdByName?: string;
  updatedAt: string;
  questions?: TeacherQuestionDto[];
  recognizedCount?: number;
  needsReviewCount?: number;
  summary?: string;
}

export interface ImportResult {
  assessmentId: string;
  recognizedCount: number;
  needsReviewCount: number;
  summary: string;
}

export interface ListAssessmentsParams {
  type?: AssessmentType;
  courseId?: string;
  status?: AssessmentStatus;
  search?: string;
  page?: number;
  limit?: number;
}

export interface AssessmentListResult {
  items: TeacherAssessmentDto[];
  total: number;
  page: number;
  limit: number;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

export function emptyPayload(type: QuestionType): Record<string, unknown> {
  if (type === 'SINGLE_CHOICE' || type === 'MULTIPLE_CHOICE') {
    return {
      options: [
        { id: 'a', text: '' },
        { id: 'b', text: '' },
      ],
      correctOptionIds: type === 'SINGLE_CHOICE' ? [] : [],
    };
  }
  if (type === 'FILL_BLANK') return { acceptedAnswers: [''] };
  if (type === 'ORDERING') return { tokens: ['', ''], correctSentence: '' };
  if (type === 'ESSAY') return { sampleAnswer: '', rubric: '' };
  if (type === 'IMAGE_BASED') {
    return {
      mediaId: '',
      options: [
        { id: 'a', text: '' },
        { id: 'b', text: '' },
      ],
      correctOptionIds: [],
    };
  }
  return { mediaId: '' };
}

export async function listAssessments(
  params: ListAssessmentsParams = {},
  options?: RequestOptions,
): Promise<AssessmentListResult> {
  const qs = buildQueryString({
    type: params.type,
    courseId: params.courseId,
    status: params.status,
    search: params.search?.trim() || undefined,
    page: params.page,
    limit: params.limit,
  });
  return requestJson<AssessmentListResult>(`/assessments${qs}`, {
    method: 'GET',
    signal: options?.signal,
  });
}

export async function getAssessment(id: string, options?: RequestOptions): Promise<TeacherAssessmentDto> {
  return requestJson<TeacherAssessmentDto>(`/assessments/${encodeURIComponent(id)}`, {
    method: 'GET',
    signal: options?.signal,
  });
}

export async function getAssessmentReview(id: string, options?: RequestOptions): Promise<TeacherAssessmentDto> {
  return requestJson<TeacherAssessmentDto>(`/assessments/${encodeURIComponent(id)}/review`, {
    method: 'GET',
    signal: options?.signal,
  });
}

export async function createAssessment(payload: {
  title: string;
  type: AssessmentType;
  courseId: string;
  description?: string;
  durationMinutes?: number;
}): Promise<TeacherAssessmentDto> {
  return requestJson<TeacherAssessmentDto>('/assessments', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateAssessment(
  id: string,
  payload: { title?: string; description?: string; durationMinutes?: number },
): Promise<TeacherAssessmentDto> {
  return requestJson<TeacherAssessmentDto>(`/assessments/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function deleteAssessment(id: string): Promise<void> {
  await requestJson(`/assessments/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export async function duplicateAssessment(id: string): Promise<TeacherAssessmentDto> {
  return requestJson<TeacherAssessmentDto>(`/assessments/${encodeURIComponent(id)}/duplicate`, {
    method: 'POST',
  });
}

export async function publishAssessment(id: string): Promise<TeacherAssessmentDto> {
  return requestJson<TeacherAssessmentDto>(`/assessments/${encodeURIComponent(id)}/publish`, {
    method: 'POST',
  });
}

export async function addQuestion(
  assessmentId: string,
  payload: { type: QuestionType; prompt: string; payload: Record<string, unknown>; points: number },
): Promise<TeacherQuestionDto> {
  return requestJson<TeacherQuestionDto>(`/assessments/${encodeURIComponent(assessmentId)}/questions`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateQuestion(
  assessmentId: string,
  questionId: string,
  payload: { prompt?: string; payload?: Record<string, unknown>; points?: number },
): Promise<TeacherQuestionDto> {
  return requestJson<TeacherQuestionDto>(
    `/assessments/${encodeURIComponent(assessmentId)}/questions/${encodeURIComponent(questionId)}`,
    { method: 'PATCH', body: JSON.stringify(payload) },
  );
}

export async function deleteQuestion(assessmentId: string, questionId: string): Promise<void> {
  await requestJson(
    `/assessments/${encodeURIComponent(assessmentId)}/questions/${encodeURIComponent(questionId)}`,
    { method: 'DELETE' },
  );
}

export async function reorderQuestions(
  assessmentId: string,
  questionIds: string[],
): Promise<TeacherQuestionDto[]> {
  return requestJson<TeacherQuestionDto[]>(
    `/assessments/${encodeURIComponent(assessmentId)}/questions/reorder`,
    { method: 'PUT', body: JSON.stringify({ questionIds }) },
  );
}

async function throwIfNotOk(response: Response, instance: string, fallback: string): Promise<void> {
  if (response.ok) return;
  let problem: ProblemDetails;
  try {
    problem = (await response.json()) as ProblemDetails;
  } catch {
    problem = {
      type: 'about:blank',
      title: response.statusText || 'HTTP Error',
      status: response.status,
      detail: fallback,
      instance,
    };
  }
  throw new ApiClientError(response.status, problem);
}

export async function listMedia(
  assessmentId: string,
  signal?: AbortSignal,
): Promise<Array<{ id: string; kind: string; mime: string }>> {
  return requestJson(`/assessments/${encodeURIComponent(assessmentId)}/media`, {
    method: 'GET',
    signal,
  });
}

export async function fetchMedia(
  assessmentId: string,
  mediaId: string,
  signal?: AbortSignal,
): Promise<Blob> {
  const instance = `/assessments/${assessmentId}/media/${mediaId}`;
  const response = await fetch(`${API_BASE_URL}${instance}`, {
    method: 'GET',
    credentials: 'include',
    headers: { 'X-Requested-With': 'XMLHttpRequest' },
    signal,
  });
  await throwIfNotOk(response, instance, 'Không tải được media');
  return response.blob();
}

export async function uploadMedia(
  assessmentId: string,
  file: File,
): Promise<{ id: string; kind: string; mime: string }> {
  const form = new FormData();
  form.append('file', file);
  const instance = `/assessments/${assessmentId}/media`;
  const response = await fetch(`${API_BASE_URL}${instance}`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'X-Requested-With': 'XMLHttpRequest' },
    body: form,
  });
  await throwIfNotOk(response, instance, 'Không thể tải media');
  return (await response.json()) as { id: string; kind: string; mime: string };
}

export async function downloadOriginal(
  assessmentId: string,
  signal?: AbortSignal,
): Promise<{ blob: Blob; filename: string }> {
  const instance = `/assessments/${assessmentId}/original`;
  const response = await fetch(`${API_BASE_URL}${instance}`, {
    method: 'GET',
    credentials: 'include',
    headers: { 'X-Requested-With': 'XMLHttpRequest' },
    signal,
  });
  await throwIfNotOk(response, instance, 'Không có file gốc để tải lại');
  const blob = await response.blob();
  const match = /filename\*?=(?:UTF-8''|")?([^";]+)/i.exec(response.headers.get('content-disposition') ?? '');
  const filename = match ? decodeURIComponent(match[1]!.replace(/"/g, '')) : 'de-goc';
  return { blob, filename };
}

export async function importAssessment(
  file: File,
  payload: { courseId: string; type: AssessmentType; title?: string },
  signal?: AbortSignal,
): Promise<ImportResult> {
  const form = new FormData();
  form.append('file', file);
  form.append('courseId', payload.courseId);
  form.append('type', payload.type);
  if (payload.title) form.append('title', payload.title);

  const response = await fetch(`${API_BASE_URL}/assessments/import`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'X-Requested-With': 'XMLHttpRequest' },
    body: form,
    signal,
  });
  await throwIfNotOk(response, '/assessments/import', 'Không thể tải đề');
  return (await response.json()) as ImportResult;
}
