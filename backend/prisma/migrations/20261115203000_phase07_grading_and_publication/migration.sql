-- Phase 7: Rule-Based Auto-Grading, On-Demand Multi-Provider AI Essay Drafts & Grade Audit Log

-- 1. Track post-publication grade adjustment timestamp on submissions
ALTER TABLE "submissions"
ADD COLUMN IF NOT EXISTS "grade_updated_at" TIMESTAMPTZ(3);

-- 2. Track AI draft suggested score and manual teacher override flag per submission answer
ALTER TABLE "submission_answers"
ADD COLUMN IF NOT EXISTS "ai_suggested_points" DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS "teacher_edited" BOOLEAN NOT NULL DEFAULT false;

-- 3. Immutable audit trail for grade adjustments (FUNC-064, DEC-038)
CREATE TABLE "grade_audit_logs" (
  "id" TEXT NOT NULL,
  "submission_id" TEXT NOT NULL,
  "answer_id" TEXT,
  "actor_id" TEXT NOT NULL,
  "old_score" DOUBLE PRECISION NOT NULL,
  "new_score" DOUBLE PRECISION NOT NULL,
  "reason" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "grade_audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "grade_audit_logs_submission_id_created_at_idx"
  ON "grade_audit_logs"("submission_id", "created_at");

CREATE INDEX "grade_audit_logs_answer_id_idx"
  ON "grade_audit_logs"("answer_id");

ALTER TABLE "grade_audit_logs"
  ADD CONSTRAINT "grade_audit_logs_submission_id_fkey"
  FOREIGN KEY ("submission_id") REFERENCES "submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "grade_audit_logs"
  ADD CONSTRAINT "grade_audit_logs_answer_id_fkey"
  FOREIGN KEY ("answer_id") REFERENCES "submission_answers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "grade_audit_logs"
  ADD CONSTRAINT "grade_audit_logs_actor_id_fkey"
  FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
