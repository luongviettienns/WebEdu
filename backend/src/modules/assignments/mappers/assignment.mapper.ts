import { AssessmentType, SubmissionStatus } from '@prisma/client';
import { sumQuestionMaxScore } from '../../grading/policies/answer-normalizer.policy.js';
import type {
  AssignmentDisplayStatus,
  ClassAssignmentStatsDto,
  ClassAssignmentSummaryDto,
  StudentAssignmentListItemDto,
  SupersededAttemptDto,
  TeacherTrackerStudentRowDto,
} from '../assignments.types.js';
import { isAnswerNonEmpty } from '../policies/submission-answer.policy.js';

export const DISPLAY_STATUS_LABELS: Record<AssignmentDisplayStatus, string> = {
  NOT_STARTED: 'Chưa làm',
  IN_PROGRESS: 'Đang làm dở',
  SUBMITTED_WAITING: 'Đã nộp - Chờ chấm',
  AUTO_GRADED_PENDING_REVIEW: 'Chờ GV duyệt điểm',
  GRADED: 'Đã chấm',
  RETURNED: 'Đã trả kết quả',
  SUPERSEDED: 'Đã mở lại lượt mới',
};

const REOPENABLE_STATUSES = new Set<SubmissionStatus>([
  SubmissionStatus.SUBMITTED_WAITING,
  SubmissionStatus.AUTO_GRADED_PENDING_REVIEW,
  SubmissionStatus.GRADED,
  SubmissionStatus.RETURNED,
]);

const SCORE_VISIBLE_STATUSES = new Set<SubmissionStatus>([SubmissionStatus.RETURNED]);

export interface StudentAssignmentRowInput {
  id: string;
  assessmentId: string;
  classId: string;
  sessionId?: string | null;
  assignedAt: Date;
  dueAt: Date;
  effectiveDurationMinutes: number | null;
  instructions: string | null;
  assessment: { title: string; type: AssessmentType; questions?: ReadonlyArray<{ points: number }> };
  class: { code: string; course?: { name: string } | null };
  session?: { id: string; sessionNumber: number | null; sessionDate: Date; startTime: string; endTime: string } | null;
}

export interface ClassAssignmentRowInput extends StudentAssignmentRowInput {
  sessionId: string | null;
  assignedById: string;
  assessment: StudentAssignmentRowInput['assessment'] & { description: string | null; courseId: string };
  assignedBy?: { fullName: string } | null;
}

export interface StudentSubmissionRowInput {
  id: string;
  attemptNumber: number;
  status: SubmissionStatus;
  elapsedSeconds: number;
  remainingSeconds: number | null;
  dueAtOverride?: Date | null;
  lastSavedAt: Date;
  submittedAt: Date | null;
  autoSubmitted: boolean;
  autoScore: number | null;
  totalScore: number | null;
  teacherFeedback: string | null;
}

export interface TrackerStudentInput {
  id: string;
  fullName: string;
  email: string;
}

export interface TrackerActiveSubmissionInput {
  id: string;
  attemptNumber: number;
  status: SubmissionStatus;
  startedAt: Date;
  lastSavedAt: Date;
  submittedAt: Date | null;
  autoSubmitted: boolean;
  elapsedSeconds: number;
  remainingSeconds: number | null;
  dueAtOverride?: Date | null;
  answers?: ReadonlyArray<{ answerPayload: unknown }>;
}

export interface SupersededAttemptWithLogsInput {
  id: string;
  attemptNumber: number;
  submittedAt: Date | null;
  reopenLogs: ReadonlyArray<{ reason: string; reopenedAt: Date }>;
}

export const resolveEffectiveDueAt = (assignmentDueAt: Date, dueAtOverride?: Date | null): Date =>
  dueAtOverride ?? assignmentDueAt;

export const getDisplayStatusLabel = (status: AssignmentDisplayStatus): string =>
  DISPLAY_STATUS_LABELS[status];

export const countNonEmptyAnswers = (answers: ReadonlyArray<{ answerPayload: unknown }>): number =>
  answers.filter((answer) => isAnswerNonEmpty(answer.answerPayload)).length;

function summarizeQuestions(
  questions?: ReadonlyArray<{ points: number }>,
): {
  questionCount: number;
  totalPoints: number;
} {
  const list = questions ?? [];
  return {
    questionCount: list.length,
    totalPoints: sumQuestionMaxScore(list),
  };
}

export function toClassAssignmentSummaryDto(
  row: ClassAssignmentRowInput,
  stats?: ClassAssignmentStatsDto,
): ClassAssignmentSummaryDto {
  const { questionCount, totalPoints } = summarizeQuestions(row.assessment.questions);
  return {
    id: row.id,
    assessmentId: row.assessmentId,
    assessmentTitle: row.assessment.title,
    assessmentType: row.assessment.type,
    description: row.assessment.description ?? '',
    courseId: row.assessment.courseId,
    classId: row.classId,
    classCode: row.class.code,
    className: row.class.course?.name ?? row.class.code,
    sessionId: row.sessionId,
    assignedById: row.assignedById,
    assignedByName: row.assignedBy?.fullName ?? '',
    assignedAt: row.assignedAt.toISOString(),
    dueAt: row.dueAt.toISOString(),
    effectiveDurationMinutes: row.effectiveDurationMinutes,
    instructions: row.instructions,
    questionCount,
    totalPoints,
    ...(stats ? { stats } : {}),
  };
}

export function toStudentAssignmentListItemDto(
  assignmentRow: StudentAssignmentRowInput,
  submissionRow: StudentSubmissionRowInput | null,
  answeredCount: number,
  now: Date = new Date(),
): StudentAssignmentListItemDto {
  const canViewScores = submissionRow !== null && SCORE_VISIBLE_STATUSES.has(submissionRow.status);
  const { questionCount, totalPoints } = summarizeQuestions(assignmentRow.assessment.questions);
  const status: AssignmentDisplayStatus = submissionRow?.status ?? 'NOT_STARTED';
  const effectiveDueAt = resolveEffectiveDueAt(assignmentRow.dueAt, submissionRow?.dueAtOverride);
  const isOverdue =
    (status === 'NOT_STARTED' || status === SubmissionStatus.IN_PROGRESS) &&
    now.getTime() > effectiveDueAt.getTime();

  return {
    assignmentId: assignmentRow.id,
    assessmentId: assignmentRow.assessmentId,
    assessmentTitle: assignmentRow.assessment.title,
    assessmentType: assignmentRow.assessment.type,
    classId: assignmentRow.classId,
    classCode: assignmentRow.class.code,
    className: assignmentRow.class.course?.name ?? assignmentRow.class.code,
    sessionId: assignmentRow.sessionId ?? assignmentRow.session?.id ?? null,
    session: assignmentRow.session ? {
      id: assignmentRow.session.id,
      sessionNumber: assignmentRow.session.sessionNumber,
      sessionDate: assignmentRow.session.sessionDate.toISOString(),
      startTime: assignmentRow.session.startTime,
      endTime: assignmentRow.session.endTime,
    } : null,
    assignedAt: assignmentRow.assignedAt.toISOString(),
    dueAt: effectiveDueAt.toISOString(),
    effectiveDurationMinutes: assignmentRow.effectiveDurationMinutes,
    instructions: assignmentRow.instructions,
    questionCount,
    totalPoints,
    isOverdue,
    submissionId: submissionRow?.id ?? null,
    attemptNumber: submissionRow?.attemptNumber ?? 0,
    status,
    displayStatusLabel: getDisplayStatusLabel(status),
    remainingSeconds: submissionRow?.remainingSeconds ?? null,
    elapsedSeconds: submissionRow?.elapsedSeconds ?? 0,
    answeredCount: submissionRow ? answeredCount : 0,
    lastSavedAt: submissionRow ? submissionRow.lastSavedAt.toISOString() : null,
    submittedAt: submissionRow?.submittedAt ? submissionRow.submittedAt.toISOString() : null,
    autoSubmitted: submissionRow?.autoSubmitted ?? false,
    autoScore: canViewScores ? submissionRow.autoScore : null,
    totalScore: canViewScores ? submissionRow.totalScore : null,
    teacherFeedback: canViewScores ? submissionRow.teacherFeedback : null,
  };
}

function mapSupersededAttempt(attempt: SupersededAttemptWithLogsInput): SupersededAttemptDto {
  const latestLog =
    attempt.reopenLogs.length > 0
      ? attempt.reopenLogs.reduce((latest, current) =>
          current.reopenedAt.getTime() > latest.reopenedAt.getTime() ? current : latest,
        )
      : null;
  return {
    submissionId: attempt.id,
    attemptNumber: attempt.attemptNumber,
    submittedAt: attempt.submittedAt ? attempt.submittedAt.toISOString() : null,
    reopenedAt: latestLog ? latestLog.reopenedAt.toISOString() : null,
    reopenReason: latestLog ? latestLog.reason : null,
  };
}

export function toTeacherTrackerStudentRowDto(
  student: TrackerStudentInput,
  activeSubmission: TrackerActiveSubmissionInput | null,
  supersededWithLogs: ReadonlyArray<SupersededAttemptWithLogsInput>,
  questionCount: number,
): TeacherTrackerStudentRowDto {
  const status: AssignmentDisplayStatus = activeSubmission?.status ?? 'NOT_STARTED';
  const totalReopenLogs = supersededWithLogs.reduce((sum, item) => sum + item.reopenLogs.length, 0);
  return {
    studentId: student.id,
    fullName: student.fullName,
    email: student.email,
    submissionId: activeSubmission?.id ?? null,
    attemptNumber: activeSubmission?.attemptNumber ?? 0,
    status,
    displayStatusLabel: getDisplayStatusLabel(status),
    answeredCount: activeSubmission ? countNonEmptyAnswers(activeSubmission.answers ?? []) : 0,
    questionCount,
    startedAt: activeSubmission ? activeSubmission.startedAt.toISOString() : null,
    lastSavedAt: activeSubmission ? activeSubmission.lastSavedAt.toISOString() : null,
    submittedAt: activeSubmission?.submittedAt ? activeSubmission.submittedAt.toISOString() : null,
    autoSubmitted: activeSubmission?.autoSubmitted ?? false,
    elapsedSeconds: activeSubmission?.elapsedSeconds ?? 0,
    remainingSeconds: activeSubmission?.remainingSeconds ?? null,
    dueAtOverride: activeSubmission?.dueAtOverride ? activeSubmission.dueAtOverride.toISOString() : null,
    canReopen: activeSubmission !== null && REOPENABLE_STATUSES.has(activeSubmission.status),
    reopenCount: totalReopenLogs > 0 ? totalReopenLogs : supersededWithLogs.length,
    supersededAttempts: supersededWithLogs.map(mapSupersededAttempt),
  };
}
