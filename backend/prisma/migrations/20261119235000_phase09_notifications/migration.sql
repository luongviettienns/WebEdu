CREATE TYPE "NotificationType" AS ENUM (
  'NEW_STUDENT_PENDING_CLASS',
  'STUDENT_ENROLLED',
  'STUDENT_TRANSFERRED',
  'STUDENT_DROPPED',
  'TEACHER_ASSIGNED_CLASS',
  'SESSION_RESCHEDULED',
  'SESSION_CANCELLED',
  'SESSION_MAKEUP_ADDED',
  'ASSIGNMENT_ASSIGNED',
  'ASSIGNMENT_DUE_SOON',
  'SUBMISSION_REOPENED',
  'SUBMISSION_PENDING_GRADING',
  'GRADE_PUBLISHED',
  'GRADE_UPDATED'
);

CREATE TABLE "notifications" (
  "id" TEXT NOT NULL,
  "recipient_id" TEXT NOT NULL,
  "type" "NotificationType" NOT NULL,
  "title" VARCHAR(180) NOT NULL,
  "body" VARCHAR(500) NOT NULL,
  "link_path" VARCHAR(255) NOT NULL,
  "dedup_key" VARCHAR(160),
  "is_read" BOOLEAN NOT NULL DEFAULT false,
  "read_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "notifications_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "notifications_recipient_id_fkey"
    FOREIGN KEY ("recipient_id") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "notifications_link_path_safe_check"
    CHECK ("link_path" ~ '^/([^/]|$)'),
  CONSTRAINT "notifications_read_consistency_check"
    CHECK (("is_read" = false AND "read_at" IS NULL) OR ("is_read" = true AND "read_at" IS NOT NULL))
);

CREATE INDEX "notifications_recipient_id_is_read_created_at_idx"
  ON "notifications"("recipient_id", "is_read", "created_at" DESC);

CREATE INDEX "notifications_recipient_id_created_at_idx"
  ON "notifications"("recipient_id", "created_at" DESC);

CREATE INDEX "notifications_created_at_idx"
  ON "notifications"("created_at");

CREATE UNIQUE INDEX "idx_notifications_recipient_dedup_key"
  ON "notifications"("recipient_id", "dedup_key")
  WHERE "dedup_key" IS NOT NULL;
