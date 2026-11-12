-- Phase 4 Schedule & Attendance Schema Migration
-- Creates lesson_sessions, session_change_logs, attendance_records, attendance_audit_logs,
-- database integrity CHECK constraints, partial unique indexes, immutability triggers,
-- and deterministic backfill of initial REGULAR sessions for existing classes.

-- CreateEnum
CREATE TYPE "SessionType" AS ENUM ('REGULAR', 'MANUAL', 'MAKEUP');

-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('SCHEDULED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SessionChangeAction" AS ENUM ('GENERATE', 'UPDATE_RECURRING_RULE', 'ADD_MANUAL', 'RESCHEDULE', 'CANCEL', 'ADD_MAKEUP');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'ABSENT', 'EXCUSED');

-- CreateTable
CREATE TABLE "lesson_sessions" (
    "id" TEXT NOT NULL,
    "class_id" TEXT NOT NULL,
    "session_number" INTEGER,
    "type" "SessionType" NOT NULL DEFAULT 'REGULAR',
    "session_date" DATE NOT NULL,
    "start_time" VARCHAR(5) NOT NULL,
    "end_time" VARCHAR(5) NOT NULL,
    "status" "SessionStatus" NOT NULL DEFAULT 'SCHEDULED',
    "is_rescheduled" BOOLEAN NOT NULL DEFAULT false,
    "is_makeup" BOOLEAN NOT NULL DEFAULT false,
    "makeup_for_session_id" TEXT,
    "topic" VARCHAR(255),
    "cancel_reason" TEXT,
    "cancelled_by_id" TEXT,
    "cancelled_at" TIMESTAMPTZ(3),
    "attendance_marked_by_id" TEXT,
    "attendance_marked_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "lesson_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session_change_logs" (
    "id" TEXT NOT NULL,
    "class_id" TEXT NOT NULL,
    "session_id" TEXT,
    "action" "SessionChangeAction" NOT NULL,
    "actor_id" TEXT NOT NULL,
    "actor_name" VARCHAR(100) NOT NULL,
    "previous_date" DATE,
    "previous_start_time" VARCHAR(5),
    "previous_end_time" VARCHAR(5),
    "new_date" DATE,
    "new_start_time" VARCHAR(5),
    "new_end_time" VARCHAR(5),
    "reason" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "session_change_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_records" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "class_id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "status" "AttendanceStatus" NOT NULL,
    "note" VARCHAR(255),
    "marked_by_id" TEXT NOT NULL,
    "marked_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_by_id" TEXT,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "attendance_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_audit_logs" (
    "id" TEXT NOT NULL,
    "attendance_record_id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "previous_status" "AttendanceStatus" NOT NULL,
    "new_status" "AttendanceStatus" NOT NULL,
    "previous_note" VARCHAR(255),
    "new_note" VARCHAR(255),
    "reason" TEXT NOT NULL,
    "actor_id" TEXT NOT NULL,
    "actor_role" "Role" NOT NULL,
    "is_admin_override" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attendance_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "lesson_sessions_makeup_for_session_id_key" ON "lesson_sessions"("makeup_for_session_id");

-- CreateIndex
CREATE INDEX "lesson_sessions_class_id_session_date_start_time_idx" ON "lesson_sessions"("class_id", "session_date", "start_time");

-- CreateIndex
CREATE INDEX "lesson_sessions_session_date_status_idx" ON "lesson_sessions"("session_date", "status");

-- Partial unique index for active (non-cancelled) session numbering per class
CREATE UNIQUE INDEX "lesson_sessions_class_active_num_unique"
    ON "lesson_sessions"("class_id", "session_number")
    WHERE "session_number" IS NOT NULL;

-- CreateIndex
CREATE INDEX "session_change_logs_class_id_created_at_idx" ON "session_change_logs"("class_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "session_change_logs_session_id_idx" ON "session_change_logs"("session_id");

-- CreateIndex
CREATE INDEX "session_change_logs_actor_id_idx" ON "session_change_logs"("actor_id");

-- CreateIndex
CREATE INDEX "session_change_logs_created_at_idx" ON "session_change_logs"("created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "attendance_records_session_id_student_id_key" ON "attendance_records"("session_id", "student_id");

-- CreateIndex
CREATE INDEX "attendance_records_class_id_student_id_status_idx" ON "attendance_records"("class_id", "student_id", "status");

-- CreateIndex
CREATE INDEX "attendance_records_student_id_idx" ON "attendance_records"("student_id");

-- CreateIndex
CREATE INDEX "attendance_audit_logs_session_id_created_at_idx" ON "attendance_audit_logs"("session_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "attendance_audit_logs_student_id_created_at_idx" ON "attendance_audit_logs"("student_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "attendance_audit_logs_attendance_record_id_idx" ON "attendance_audit_logs"("attendance_record_id");

-- AddForeignKey
ALTER TABLE "lesson_sessions" ADD CONSTRAINT "lesson_sessions_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_sessions" ADD CONSTRAINT "lesson_sessions_makeup_for_session_id_fkey" FOREIGN KEY ("makeup_for_session_id") REFERENCES "lesson_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_sessions" ADD CONSTRAINT "lesson_sessions_cancelled_by_id_fkey" FOREIGN KEY ("cancelled_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_sessions" ADD CONSTRAINT "lesson_sessions_attendance_marked_by_id_fkey" FOREIGN KEY ("attendance_marked_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_change_logs" ADD CONSTRAINT "session_change_logs_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_change_logs" ADD CONSTRAINT "session_change_logs_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "lesson_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_change_logs" ADD CONSTRAINT "session_change_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "lesson_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_marked_by_id_fkey" FOREIGN KEY ("marked_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_audit_logs" ADD CONSTRAINT "attendance_audit_logs_attendance_record_id_fkey" FOREIGN KEY ("attendance_record_id") REFERENCES "attendance_records"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_audit_logs" ADD CONSTRAINT "attendance_audit_logs_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "lesson_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_audit_logs" ADD CONSTRAINT "attendance_audit_logs_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_audit_logs" ADD CONSTRAINT "attendance_audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Data Integrity CHECK constraints on lesson_sessions
ALTER TABLE "lesson_sessions"
ADD CONSTRAINT "lesson_sessions_session_number_status_chk"
CHECK (
  ("status" = 'CANCELLED'::"SessionStatus" AND "session_number" IS NULL)
  OR ("status" <> 'CANCELLED'::"SessionStatus" AND "session_number" IS NOT NULL AND "session_number" > 0)
);

ALTER TABLE "lesson_sessions"
ADD CONSTRAINT "lesson_sessions_time_range_chk"
CHECK (
  "start_time" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
  AND "end_time" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
  AND "end_time" > "start_time"
);

ALTER TABLE "lesson_sessions"
ADD CONSTRAINT "lesson_sessions_makeup_flag_chk"
CHECK (
  ("type" = 'MAKEUP'::"SessionType" AND "is_makeup" = true)
  OR ("type" <> 'MAKEUP'::"SessionType" AND "is_makeup" = false AND "makeup_for_session_id" IS NULL)
);

-- Append-only immutability triggers for schedule change logs and attendance audit logs
CREATE OR REPLACE FUNCTION "prevent_phase04_audit_mutation"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION '% records are append-only and cannot be updated or deleted', TG_TABLE_NAME;
END;
$$;

CREATE TRIGGER "trg_session_change_logs_immutable"
BEFORE UPDATE OR DELETE ON "session_change_logs"
FOR EACH ROW
EXECUTE FUNCTION "prevent_phase04_audit_mutation"();

CREATE TRIGGER "trg_attendance_audit_logs_immutable"
BEFORE UPDATE OR DELETE ON "attendance_audit_logs"
FOR EACH ROW
EXECUTE FUNCTION "prevent_phase04_audit_mutation"();

-- Deterministic backfill of REGULAR SCHEDULED lesson_sessions for any pre-existing classes
DO $$
DECLARE
  cls RECORD;
  cursor_date DATE;
  seq_num INTEGER;
BEGIN
  FOR cls IN
    SELECT c."id", c."start_date", c."total_sessions", c."schedule_days", c."schedule_start_time", c."schedule_end_time"
    FROM "classes" c
    WHERE NOT EXISTS (
      SELECT 1 FROM "lesson_sessions" ls WHERE ls."class_id" = c."id"
    )
    ORDER BY c."created_at" ASC
  LOOP
    cursor_date := cls."start_date";
    seq_num := 0;
    WHILE seq_num < cls."total_sessions" LOOP
      IF EXTRACT(DOW FROM cursor_date)::integer = ANY(cls."schedule_days") THEN
        seq_num := seq_num + 1;
        INSERT INTO "lesson_sessions" (
          "id",
          "class_id",
          "session_number",
          "type",
          "session_date",
          "start_time",
          "end_time",
          "status",
          "is_rescheduled",
          "is_makeup",
          "created_at",
          "updated_at"
        )
        VALUES (
          gen_random_uuid()::text,
          cls."id",
          seq_num,
          'REGULAR'::"SessionType",
          cursor_date,
          cls."schedule_start_time",
          cls."schedule_end_time",
          'SCHEDULED'::"SessionStatus",
          false,
          false,
          CURRENT_TIMESTAMP,
          CURRENT_TIMESTAMP
        );
      END IF;
      cursor_date := cursor_date + INTERVAL '1 day';
    END LOOP;
  END LOOP;
END;
$$;
