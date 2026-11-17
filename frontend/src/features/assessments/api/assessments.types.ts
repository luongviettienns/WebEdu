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
