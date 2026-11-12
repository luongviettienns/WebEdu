-- Fix PostgreSQL trigger locking order + pre-lock snapshot race and add expiry indexes for AuthMaintenanceService
CREATE INDEX "password_reset_tokens_expires_at_idx"
ON "password_reset_tokens"("expires_at");

CREATE INDEX "email_verifications_expires_at_idx"
ON "email_verifications"("expires_at");

CREATE OR REPLACE FUNCTION "sync_teacher_active_classes_count"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_first_id text;
  v_second_id text;
  v_count integer;
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM 1 FROM "teacher_profiles" WHERE "user_id" = OLD."teacher_id" FOR UPDATE;
    SELECT COUNT(*)::integer INTO v_count
    FROM "classes"
    WHERE "teacher_id" = OLD."teacher_id"
      AND "status" IN ('UPCOMING'::"ClassStatus", 'ACTIVE'::"ClassStatus");
    UPDATE "teacher_profiles"
    SET "active_classes_count" = v_count
    WHERE "user_id" = OLD."teacher_id";
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD."teacher_id" IS DISTINCT FROM NEW."teacher_id" THEN
    IF OLD."teacher_id" < NEW."teacher_id" THEN
      v_first_id := OLD."teacher_id";
      v_second_id := NEW."teacher_id";
    ELSE
      v_first_id := NEW."teacher_id";
      v_second_id := OLD."teacher_id";
    END IF;

    PERFORM 1 FROM "teacher_profiles" WHERE "user_id" = v_first_id FOR UPDATE;
    PERFORM 1 FROM "teacher_profiles" WHERE "user_id" = v_second_id FOR UPDATE;

    SELECT COUNT(*)::integer INTO v_count
    FROM "classes"
    WHERE "teacher_id" = OLD."teacher_id"
      AND "status" IN ('UPCOMING'::"ClassStatus", 'ACTIVE'::"ClassStatus");
    UPDATE "teacher_profiles"
    SET "active_classes_count" = v_count
    WHERE "user_id" = OLD."teacher_id";

    SELECT COUNT(*)::integer INTO v_count
    FROM "classes"
    WHERE "teacher_id" = NEW."teacher_id"
      AND "status" IN ('UPCOMING'::"ClassStatus", 'ACTIVE'::"ClassStatus");
    UPDATE "teacher_profiles"
    SET "active_classes_count" = v_count
    WHERE "user_id" = NEW."teacher_id";

    RETURN NEW;
  END IF;

  PERFORM 1 FROM "teacher_profiles" WHERE "user_id" = NEW."teacher_id" FOR UPDATE;
  SELECT COUNT(*)::integer INTO v_count
  FROM "classes"
  WHERE "teacher_id" = NEW."teacher_id"
    AND "status" IN ('UPCOMING'::"ClassStatus", 'ACTIVE'::"ClassStatus");
  UPDATE "teacher_profiles"
  SET "active_classes_count" = v_count
  WHERE "user_id" = NEW."teacher_id";

  RETURN NEW;
END;
$$;
