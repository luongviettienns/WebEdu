import type { TeacherAssessmentDto, TeacherQuestionDto } from '../assessments.types.js';

type QuestionRow = {
  id: string;
  type: TeacherQuestionDto['type'];
  position: number;
  prompt: string;
  payload: unknown;
  points: number;
  needsReview: boolean;
};

type AssessmentRow = {
  id: string;
  title: string;
  description?: string | null;
  type: TeacherAssessmentDto['type'];
  courseId: string;
  durationMinutes: number | null;
  status: TeacherAssessmentDto['status'];
  isLocked: boolean;
  originalFileName?: string | null;
  createdById: string;
  updatedAt: Date;
  createdBy?: { fullName: string } | null;
  questions?: QuestionRow[];
};

export function toTeacherQuestionDto(q: QuestionRow): TeacherQuestionDto {
  return {
    id: q.id,
    type: q.type,
    position: q.position,
    prompt: q.prompt,
    payload: (q.payload ?? {}) as Record<string, unknown>,
    points: q.points,
    needsReview: q.needsReview,
  };
}

export function toTeacherAssessmentDto(a: AssessmentRow): TeacherAssessmentDto {
  const questions = a.questions?.map(toTeacherQuestionDto) ?? [];
  return {
    id: a.id,
    title: a.title,
    description: a.description ?? '',
    type: a.type,
    courseId: a.courseId,
    durationMinutes: a.durationMinutes,
    status: a.status,
    isLocked: a.isLocked,
    originalFileName: a.originalFileName ?? null,
    assignedClassCount: 0,
    totalPoints: questions.reduce((sum, q) => sum + q.points, 0),
    questionCount: questions.length,
    createdById: a.createdById,
    createdByName: a.createdBy?.fullName ?? '',
    updatedAt: a.updatedAt.toISOString(),
    questions,
  };
}
