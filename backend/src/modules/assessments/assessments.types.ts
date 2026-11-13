import type { AssessmentStatus, AssessmentType, QuestionType } from '@prisma/client';

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
  description: string;
  type: AssessmentType;
  courseId: string;
  durationMinutes: number | null;
  status: AssessmentStatus;
  isLocked: boolean;
  originalFileName: string | null;
  assignedClassCount: number;
  totalPoints: number;
  questionCount: number;
  createdById: string;
  createdByName: string;
  updatedAt: string;
  questions?: TeacherQuestionDto[];
}

export interface AssessmentListResult {
  items: TeacherAssessmentDto[];
  total: number;
  page: number;
  limit: number;
}
