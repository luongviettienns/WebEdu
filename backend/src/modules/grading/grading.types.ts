import type {
  AssessmentType,
  GradingStatus,
  QuestionType,
  SubmissionStatus,
} from '@prisma/client';
import type { AssignmentDisplayStatus } from '../assignments/assignments.types.js';

export type AiProviderType = 'OPENAI' | 'GEMINI' | 'CUSTOM';

export type GradingTrackerStatusFilter =
  | 'ALL'
  | 'NEEDS_GRADING'
  | 'CONFIRMED'
  | 'PUBLISHED'
  | 'OVERDUE_NOT_SUBMITTED'
  | 'NOT_STARTED'
  | 'IN_PROGRESS';

export interface QuestionForGrading {
  id: string;
  position: number;
  type: QuestionType;
  prompt: string;
  points: number;
  payload: unknown;
}

export interface EvaluatedQuestionGrade {
  questionId: string;
  isObjective: boolean;
  isCorrect: boolean | null;
  earnedPoints: number | null;
}

export interface SubmissionAutoGradeSummary {
  autoScore: number;
  hasSubjectiveQuestions: boolean;
  questionResults: EvaluatedQuestionGrade[];
}

export interface AutoGradeSubmissionResultDto {
  submissionId: string;
  status: SubmissionStatus;
  gradingStatus: GradingStatus;
  autoScore: number;
  totalScore: number | null;
  hasSubjectiveQuestions: boolean;
  gradedObjectiveCount: number;
  totalQuestionsCount: number;
}

export interface AiGradingConfigDto {
  enabled: boolean;
  provider: AiProviderType;
  baseUrl: string;
  model: string;
  hasApiKey: boolean;
  maskedApiKey: string | null;
  timeoutMs: number;
  updatedAt: string | null;
}

export interface AiResolvedRuntimeConfig {
  enabled: boolean;
  provider: AiProviderType;
  baseUrl: string;
  model: string;
  apiKey: string;
  timeoutMs: number;
}

export interface AiConnectionTestResultDto {
  ok: boolean;
  provider: AiProviderType;
  model: string;
  latencyMs: number;
  message: string;
}

/** Strict Zero-PII payload permitted for AI essay grading suggestions. */
export interface AiEssayGradingInput {
  prompt: string;
  maxPoints: number;
  courseLevel?: string | null;
  sampleAnswer: string | null;
  rubric: string | null;
  studentAnswer: string;
}

export interface AiEssayGradingDraftOutput {
  suggestedPoints: number;
  feedback: string;
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
  provider: AiProviderType;
  model: string;
  suggestions: AiEssaySuggestionItemDto[];
}

export interface AiBatchSuggestGradeItemDto {
  submissionId: string;
  ok: boolean;
  gradingStatus?: GradingStatus;
  suggestedCount?: number;
  error?: string;
}

export interface AiBatchSuggestGradeResultDto {
  assignmentId: string;
  requestedCount: number;
  succeededCount: number;
  failedCount: number;
  results: AiBatchSuggestGradeItemDto[];
}

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
  student: {
    id: string;
    fullName: string;
    email: string;
  };
  questions: TeacherGradingQuestionDetailDto[];
  auditLogs: GradeAuditLogItemDto[];
  navigation: {
    prevSubmissionId: string | null;
    nextSubmissionId: string | null;
  };
}

export interface ManualGradeMutationResultDto {
  submissionId: string;
  status: SubmissionStatus;
  gradingStatus: GradingStatus;
  autoScore: number | null;
  totalScore: number | null;
  teacherFeedback: string | null;
  ungradedSubjectiveCount: number;
  readyToConfirm: boolean;
}

export interface RecordOverdueZeroResultDto {
  assignmentId: string;
  recordedCount: number;
  recordedStudentIds: string[];
  submissionIds: string[];
}

export interface ConfirmGradeResultDto {
  submissionId: string;
  status: SubmissionStatus;
  gradingStatus: GradingStatus;
  totalScore: number;
  gradedAt: string;
  gradedById: string;
}

export interface BatchConfirmGradesResultDto {
  assignmentId: string;
  confirmedCount: number;
  confirmedSubmissionIds: string[];
  skippedUngradedIds: string[];
}

export interface AssignmentScoresPublishedEvent {
  assignmentId: string;
  classId: string;
  submissionIds: string[];
  studentIds: string[];
  publishedById: string;
  publishedAt: string;
}

export interface PublishGradesResultDto {
  assignmentId: string;
  publishedCount: number;
  publishedSubmissionIds: string[];
  publishedAt: string;
  overdueUntouchedCount: number;
}

export interface AdjustGradeResultDto {
  submissionId: string;
  status: SubmissionStatus;
  previousTotalScore: number | null;
  totalScore: number;
  teacherFeedback: string | null;
  gradeUpdatedAt: string | null;
  auditLogsCreated: number;
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
