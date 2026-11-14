-- Phase 6: Assignment Delivery, Exam Taking, Autosave, Single-Attempt Submission & Reopen
-- Creates SubmissionStatus, GradingStatus enums and class_assignments, submissions,
-- submission_answers, submission_reopen_logs tables with partial unique index & CHECK constraints.

-- CreateEnum
CREATE TYPE "SubmissionStatus" AS ENUM (
  'IN_PROGRESS',
  'SUBMITTED_WAITING',
  'AUTO_GRADED_PENDING_REVIEW',
  'GRADED',
  'RETURNED',
  'SUPERSEDED'
);

-- CreateEnum
CREATE TYPE "GradingStatus" AS ENUM (
  'NONE',
  'PENDING_AI',
  'AI_DRAFT_READY',
  'GRADED'
);

-- CreateTable
CREATE TABLE "class_assignments" (
  "id" TEXT NOT NULL,
  "assessment_id" TEXT NOT NULL,
  "class_id" TEXT NOT NULL,
  "session_id" TEXT,
  "assigned_by_id" TEXT NOT NULL,
  "assigned_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "due_at" TIMESTAMPTZ(3) NOT NULL,
  "effective_duration_minutes" INTEGER,
  "instructions" TEXT,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,

  CONSTRAINT "class_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "submissions" (
  "id" TEXT NOT NULL,
  "class_assignment_id" TEXT NOT NULL,
  "student_id" TEXT NOT NULL,
  "attempt_number" INTEGER NOT NULL DEFAULT 1,
  "status" "SubmissionStatus" NOT NULL DEFAULT 'IN_PROGRESS',
  "grading_status" "GradingStatus" NOT NULL DEFAULT 'NONE',
  "started_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "last_saved_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "last_synced_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "elapsed_seconds" INTEGER NOT NULL DEFAULT 0,
  "remaining_seconds" INTEGER,
  "submitted_at" TIMESTAMPTZ(3),
  "auto_submitted" BOOLEAN NOT NULL DEFAULT false,
  "auto_score" DOUBLE PRECISION,
  "total_score" DOUBLE PRECISION,
  "teacher_feedback" TEXT,
  "graded_at" TIMESTAMPTZ(3),
  "graded_by_id" TEXT,
  "returned_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,

  CONSTRAINT "submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "submission_answers" (
  "id" TEXT NOT NULL,
  "submission_id" TEXT NOT NULL,
  "question_id" TEXT NOT NULL,
  "answer_payload" JSONB NOT NULL,
  "audio_play_count" INTEGER NOT NULL DEFAULT 0,
  "is_correct" BOOLEAN,
  "earned_points" DOUBLE PRECISION,
  "ai_feedback" TEXT,
  "teacher_comment" TEXT,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,

  CONSTRAINT "submission_answers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "submission_reopen_logs" (
  "id" TEXT NOT NULL,
  "submission_id" TEXT NOT NULL,
  "reopened_by_id" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "reopened_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "submission_reopen_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "class_assignments_class_id_due_at_idx" ON "class_assignments"("class_id", "due_at");
CREATE INDEX "class_assignments_assessment_id_idx" ON "class_assignments"("assessment_id");
CREATE INDEX "class_assignments_session_id_idx" ON "class_assignments"("session_id");

CREATE UNIQUE INDEX "submissions_class_assignment_id_student_id_attempt_number_key"
  ON "submissions"("class_assignment_id", "student_id", "attempt_number");
CREATE INDEX "submissions_student_id_status_idx" ON "submissions"("student_id", "status");
CREATE INDEX "submissions_class_assignment_id_status_idx" ON "submissions"("class_assignment_id", "status");

-- Partial Unique Index: at most ONE active (non-superseded) submission per student per assignment
CREATE UNIQUE INDEX "idx_unique_active_submission_per_student"
  ON "submissions"("class_assignment_id", "student_id")
  WHERE status <> 'SUPERSEDED';

CREATE UNIQUE INDEX "submission_answers_submission_id_question_id_key"
  ON "submission_answers"("submission_id", "question_id");
CREATE INDEX "submission_answers_submission_id_idx" ON "submission_answers"("submission_id");

CREATE INDEX "submission_reopen_logs_submission_id_idx" ON "submission_reopen_logs"("submission_id");

-- AddForeignKey
ALTER TABLE "class_assignments"
  ADD CONSTRAINT "class_assignments_assessment_id_fkey"
  FOREIGN KEY ("assessment_id") REFERENCES "assessments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "class_assignments"
  ADD CONSTRAINT "class_assignments_class_id_fkey"
  FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "class_assignments"
  ADD CONSTRAINT "class_assignments_session_id_fkey"
  FOREIGN KEY ("session_id") REFERENCES "lesson_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "class_assignments"
  ADD CONSTRAINT "class_assignments_assigned_by_id_fkey"
  FOREIGN KEY ("assigned_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "submissions"
  ADD CONSTRAINT "submissions_class_assignment_id_fkey"
  FOREIGN KEY ("class_assignment_id") REFERENCES "class_assignments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "submissions"
  ADD CONSTRAINT "submissions_student_id_fkey"
  FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "submissions"
  ADD CONSTRAINT "submissions_graded_by_id_fkey"
  FOREIGN KEY ("graded_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "submission_answers"
  ADD CONSTRAINT "submission_answers_submission_id_fkey"
  FOREIGN KEY ("submission_id") REFERENCES "submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "submission_answers"
  ADD CONSTRAINT "submission_answers_question_id_fkey"
  FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "submission_reopen_logs"
  ADD CONSTRAINT "submission_reopen_logs_submission_id_fkey"
  FOREIGN KEY ("submission_id") REFERENCES "submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "submission_reopen_logs"
  ADD CONSTRAINT "submission_reopen_logs_reopened_by_id_fkey"
  FOREIGN KEY ("reopened_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Data integrity CHECK constraints
ALTER TABLE "class_assignments"
  ADD CONSTRAINT "chk_class_assignments_duration_positive"
  CHECK ("effective_duration_minutes" IS NULL OR "effective_duration_minutes" > 0);

ALTER TABLE "submissions"
  ADD CONSTRAINT "chk_submissions_attempt_positive"
  CHECK ("attempt_number" >= 1);

ALTER TABLE "submissions"
  ADD CONSTRAINT "chk_submissions_elapsed_non_negative"
  CHECK ("elapsed_seconds" >= 0);

ALTER TABLE "submissions"
  ADD CONSTRAINT "chk_submissions_remaining_non_negative"
  CHECK ("remaining_seconds" IS NULL OR "remaining_seconds" >= 0);

ALTER TABLE "submission_answers"
  ADD CONSTRAINT "chk_submission_answers_audio_non_negative"
  CHECK ("audio_play_count" >= 0);
