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
  type: AssessmentType;
  courseId: string;
  durationMinutes: number | null;
  status: AssessmentStatus;
  isLocked: boolean;
  totalPoints: number;
  questionCount: number;
  createdById: string;
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
  if (type === 'ORDERING') return { tokens: ['', ''] };
  if (type === 'ESSAY') return { sampleAnswer: '', rubric: '' };
  return { mediaId: '' };
}

export async function listAssessments(
  params: ListAssessmentsParams = {},
  options?: RequestOptions,
): Promise<TeacherAssessmentDto[]> {
  const qs = buildQueryString({
    type: params.type,
    courseId: params.courseId,
    status: params.status,
    search: params.search?.trim() || undefined,
  });
  return requestJson<TeacherAssessmentDto[]>(`/assessments${qs}`, {
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
  durationMinutes?: number;
}): Promise<TeacherAssessmentDto> {
  return requestJson<TeacherAssessmentDto>('/assessments', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateAssessment(
  id: string,
  payload: { title?: string; durationMinutes?: number },
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
  if (!response.ok) {
    let problem: ProblemDetails;
    try {
      problem = (await response.json()) as ProblemDetails;
    } catch {
      problem = {
        type: 'about:blank',
        title: response.statusText || 'HTTP Error',
        status: response.status,
        detail: 'Không thể tải đề',
        instance: '/assessments/import',
      };
    }
    throw new ApiClientError(response.status, problem);
  }
  return (await response.json()) as ImportResult;
}
