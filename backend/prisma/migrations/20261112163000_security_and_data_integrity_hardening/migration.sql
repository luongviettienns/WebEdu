-- Security, Operations, and Data Integrity Hardening
-- 1. Operational index for audit log queries filtered by target entity (e.g., Phase 4 schedule change logs)
CREATE INDEX "system_audit_logs_target_type_target_id_created_at_idx"
ON "system_audit_logs"("target_type", "target_id", "created_at" DESC);

-- 2. Tighter domain CHECK constraints on classes, enrollments, and teacher assignments
ALTER TABLE "classes"
DROP CONSTRAINT IF EXISTS "classes_total_sessions_positive_chk";

ALTER TABLE "classes"
ADD CONSTRAINT "classes_total_sessions_range_chk"
CHECK ("total_sessions" BETWEEN 1 AND 200);

ALTER TABLE "classes"
ADD CONSTRAINT "classes_schedule_days_bounds_chk"
CHECK (
  cardinality("schedule_days") BETWEEN 1 AND 7
  AND "schedule_days" <@ ARRAY[0, 1, 2, 3, 4, 5, 6]::integer[]
);

ALTER TABLE "classes"
ADD CONSTRAINT "classes_schedule_time_range_chk"
CHECK (
  "schedule_start_time" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
  AND "schedule_end_time" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
  AND "schedule_end_time" > "schedule_start_time"
);

ALTER TABLE "enrollments"
ADD CONSTRAINT "enrollments_left_after_enrolled_chk"
CHECK ("left_date" IS NULL OR "left_date" >= "enrolled_date");

ALTER TABLE "class_teacher_assignments"
ADD CONSTRAINT "class_teacher_assignments_to_after_from_chk"
CHECK ("assigned_to" IS NULL OR "assigned_to" >= "assigned_from");

-- 3. PostgreSQL trigger keeping teacher_profiles.active_classes_count in sync with classes (UPCOMING + ACTIVE)
CREATE OR REPLACE FUNCTION "sync_teacher_active_classes_count"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    UPDATE "teacher_profiles"
    SET "active_classes_count" = (
      SELECT COUNT(*)::integer
      FROM "classes"
      WHERE "teacher_id" = OLD."teacher_id"
        AND "status" IN ('UPCOMING'::"ClassStatus", 'ACTIVE'::"ClassStatus")
    )
    WHERE "user_id" = OLD."teacher_id";
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD."teacher_id" IS DISTINCT FROM NEW."teacher_id" THEN
    UPDATE "teacher_profiles"
    SET "active_classes_count" = (
      SELECT COUNT(*)::integer
      FROM "classes"
      WHERE "teacher_id" = OLD."teacher_id"
        AND "status" IN ('UPCOMING'::"ClassStatus", 'ACTIVE'::"ClassStatus")
    )
    WHERE "user_id" = OLD."teacher_id";
  END IF;

  UPDATE "teacher_profiles"
  SET "active_classes_count" = (
    SELECT COUNT(*)::integer
    FROM "classes"
    WHERE "teacher_id" = NEW."teacher_id"
      AND "status" IN ('UPCOMING'::"ClassStatus", 'ACTIVE'::"ClassStatus")
  )
  WHERE "user_id" = NEW."teacher_id";

  RETURN NEW;
END;
$$;

CREATE TRIGGER "trg_classes_sync_teacher_active_count"
AFTER INSERT OR UPDATE OF "status", "teacher_id" OR DELETE ON "classes"
FOR EACH ROW
EXECUTE FUNCTION "sync_teacher_active_classes_count"();

-- Recompute existing materialized counters once at migration time
UPDATE "teacher_profiles" tp
SET "active_classes_count" = (
  SELECT COUNT(*)::integer
  FROM "classes" c
  WHERE c."teacher_id" = tp."user_id"
    AND c."status" IN ('UPCOMING'::"ClassStatus", 'ACTIVE'::"ClassStatus")
);

-- 4. Enforce append-only immutability on guardian_consents (history is never overwritten even when >= 16 user updates email)
CREATE OR REPLACE FUNCTION "prevent_guardian_consent_mutation"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'guardian_consents records are immutable; updates and deletes are prohibited';
END;
$$;

CREATE TRIGGER "trg_guardian_consents_immutable"
BEFORE UPDATE OR DELETE ON "guardian_consents"
FOR EACH ROW
EXECUTE FUNCTION "prevent_guardian_consent_mutation"();
