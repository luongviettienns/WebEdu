import { AssessmentType, GradingStatus, QuestionType, SubmissionStatus } from '@prisma/client';
import {
  getDisplayStatusLabel,
  resolveEffectiveDueAt,
} from '../../assignments/mappers/assignment.mapper.js';
import type { AssignmentDisplayStatus } from '../../assignments/assignments.types.js';
import { isRecord } from '../../assignments/policies/submission-payload.util.js';
import type {
  GradeAuditLogItemDto,
  GradingTrackerAssignmentDto,
  GradingTrackerStudentRowDto,
  QuestionForGrading,
  StudentPublishedQuestionResultDto,
  TeacherGradingQuestionDetailDto,
} from '../grading.types.js';
import { roundToQuarter } from '../policies/answer-normalizer.policy.js';
import {
  computeSubmissionScoreSummary,
  isObjectiveQuestion,
} from '../policies/grading-workflow.policy.js';

export interface TrackerAssignmentInput {
  id: string;
  assessmentId: string;
  classId: string;
  dueAt: Date;
  assessment: { title: string; type: AssessmentType; questions: QuestionForGrading[] };
  class: { code: string; course: { name: string } | null };
}

export interface TrackerSubmissionAnswerInput {
  id: string;
  questionId: string;
  answerPayload: unknown;
  audioPlayCount: number;
  isCorrect: boolean | null;
  earnedPoints: number | null;
  aiSuggestedPoints: number | null;
  aiFeedback: string | null;
  teacherComment: string | null;
  teacherEdited: boolean;
}

export interface TrackerSubmissionInput {
  id: string;
  attemptNumber: number;
  status: SubmissionStatus;
  gradingStatus: GradingStatus;
  dueAtOverride: Date | null;
  submittedAt: Date | null;
  autoSubmitted: boolean;
  autoScore: number | null;
  totalScore: number | null;
  gradeUpdatedAt: Date | null;
  answers: TrackerSubmissionAnswerInput[];
}

export function toGradingTrackerAssignmentDto(
  row: TrackerAssignmentInput,
): GradingTrackerAssignmentDto {
  const questions = row.assessment.questions;
  return {
    id: row.id,
    assessmentId: row.assessmentId,
    assessmentTitle: row.assessment.title,
    assessmentType: row.assessment.type,
    classId: row.classId,
    classCode: row.class.code,
    className: row.class.course?.name ?? row.class.code,
    dueAt: row.dueAt.toISOString(),
    totalPoints: roundToQuarter(questions.reduce((sum, q) => sum + q.points, 0)),
    questionCount: questions.length,
    hasSubjectiveQuestions: questions.some((q) => !isObjectiveQuestion(q)),
  };
}

export function toGradingTrackerStudentRow(
  student: { id: string; fullName: string; email: string },
  activeSub: TrackerSubmissionInput | null,
  classDueAt: Date,
  questions: ReadonlyArray<QuestionForGrading>,
  now: Date,
): GradingTrackerStudentRowDto {
  const status: AssignmentDisplayStatus = activeSub?.status ?? 'NOT_STARTED';
  const effectiveDueAt = resolveEffectiveDueAt(classDueAt, activeSub?.dueAtOverride);
  const isNotSubmittedYet = activeSub === null || activeSub.status === SubmissionStatus.IN_PROGRESS;
  const isOverdueNotSubmitted = isNotSubmittedYet && now.getTime() > effectiveDueAt.getTime();
  const isLateSubmission =
    activeSub?.submittedAt !== null &&
    activeSub?.submittedAt !== undefined &&
    activeSub.submittedAt.getTime() > effectiveDueAt.getTime();

  const answerMap = new Map((activeSub?.answers ?? []).map((ans) => [ans.questionId, ans]));
  const scoreSummary = computeSubmissionScoreSummary(questions, answerMap);
  const hasAiDraft = (activeSub?.answers ?? []).some((ans) => ans.aiSuggestedPoints !== null);
  const canGrade =
    activeSub?.status === SubmissionStatus.SUBMITTED_WAITING ||
    activeSub?.status === SubmissionStatus.AUTO_GRADED_PENDING_REVIEW;
  const canAdjustGrade =
    activeSub?.status === SubmissionStatus.GRADED || activeSub?.status === SubmissionStatus.RETURNED;

  return {
    studentId: student.id,
    fullName: student.fullName,
    email: student.email,
    submissionId: activeSub?.id ?? null,
    attemptNumber: activeSub?.attemptNumber ?? 0,
    status,
    displayStatusLabel: getDisplayStatusLabel(status),
    gradingStatus: activeSub?.gradingStatus ?? null,
    isOverdueNotSubmitted,
    isLateSubmission,
    effectiveDueAt: effectiveDueAt.toISOString(),
    submittedAt: activeSub?.submittedAt ? activeSub.submittedAt.toISOString() : null,
    autoSubmitted: activeSub?.autoSubmitted ?? false,
    autoScore: activeSub?.autoScore ?? null,
    totalScore: activeSub?.totalScore ?? null,
    ungradedSubjectiveCount: activeSub ? scoreSummary.ungradedSubjectiveCount : 0,
    hasAiDraft,
    gradeUpdatedAt: activeSub?.gradeUpdatedAt ? activeSub.gradeUpdatedAt.toISOString() : null,
    canGrade,
    canAdjustGrade,
    canConfirm: Boolean(canGrade && scoreSummary.ungradedSubjectiveCount === 0),
    canPublish: activeSub?.status === SubmissionStatus.GRADED,
    canRecordOverdueZero: isOverdueNotSubmitted,
  };
}

export function toTeacherGradingQuestionDetail(
  question: QuestionForGrading,
  answer?: TrackerSubmissionAnswerInput,
): TeacherGradingQuestionDetailDto {
  const payload = isRecord(question.payload) ? question.payload : {};
  return {
    questionId: question.id,
    position: question.position,
    type: question.type,
    prompt: question.prompt,
    points: question.points,
    isObjective: isObjectiveQuestion(question),
    questionPayload: payload,
    studentAnswer: {
      answerId: answer?.id ?? null,
      answerPayload: isRecord(answer?.answerPayload) ? answer.answerPayload : {},
      audioPlayCount: answer?.audioPlayCount ?? 0,
      isCorrect: answer?.isCorrect ?? null,
      earnedPoints: answer?.earnedPoints ?? null,
      aiSuggestedPoints: answer?.aiSuggestedPoints ?? null,
      aiFeedback: answer?.aiFeedback ?? null,
      teacherComment: answer?.teacherComment ?? null,
      teacherEdited: answer?.teacherEdited ?? false,
    },
  };
}

export function toPublishedStudentQuestionResult(
  question: QuestionForGrading,
  answer?: Pick<
    TrackerSubmissionAnswerInput,
    'answerPayload' | 'isCorrect' | 'earnedPoints' | 'teacherComment'
  >,
): StudentPublishedQuestionResultDto {
  const objective = isObjectiveQuestion(question);
  const payload = isRecord(question.payload) ? question.payload : {};
  const explanation =
    typeof payload.explanation === 'string' && payload.explanation.trim()
      ? payload.explanation.trim()
      : null;

  return {
    questionId: question.id,
    position: question.position,
    type: question.type,
    prompt: question.prompt,
    points: question.points,
    isObjective: objective,
    studentAnswer: {
      answerPayload: isRecord(answer?.answerPayload) ? answer.answerPayload : {},
      isCorrect: answer?.isCorrect ?? null,
      earnedPoints: answer?.earnedPoints ?? null,
      teacherComment: answer?.teacherComment ?? null,
    },
    correctAnswer: objective ? extractSafePublishedCorrectAnswer(question.type, payload) : null,
    explanation,
  };
}

function extractSafePublishedCorrectAnswer(
  type: QuestionType,
  payload: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  if (Array.isArray(payload.options)) {
    result.options = payload.options;
  }
  if (Array.isArray(payload.correctOptionIds)) {
    result.correctOptionIds = payload.correctOptionIds;
  }
  if (Array.isArray(payload.acceptedAnswers)) {
    result.acceptedAnswers = payload.acceptedAnswers;
  }
  if (typeof payload.correctSentence === 'string') {
    result.correctSentence = payload.correctSentence;
  }
  if (typeof payload.mediaId === 'string') {
    result.mediaId = payload.mediaId;
  }
  if (typeof payload.caption === 'string') {
    result.caption = payload.caption;
  }
  if (type === QuestionType.MULTIPLE_CHOICE || typeof payload.multiple === 'boolean') {
    result.multiple = payload.multiple === true || type === QuestionType.MULTIPLE_CHOICE;
  }
  return result;
}

export function toGradeAuditLogItemDto(row: {
  id: string;
  answerId: string | null;
  answer?: { question?: { id: string; position: number } | null } | null;
  actorId: string;
  actor: { fullName: string };
  oldScore: number;
  newScore: number;
  reason: string;
  createdAt: Date;
}): GradeAuditLogItemDto {
  return {
    id: row.id,
    answerId: row.answerId,
    questionId: row.answer?.question?.id ?? null,
    questionPosition: row.answer?.question?.position ?? null,
    actorId: row.actorId,
    actorName: row.actor.fullName,
    oldScore: row.oldScore,
    newScore: row.newScore,
    reason: row.reason,
    createdAt: row.createdAt.toISOString(),
  };
}
