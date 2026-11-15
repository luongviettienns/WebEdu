-- 1. Track last audio listen window timestamp per (submission_id, question_id) to prevent seek/range request quota drain
ALTER TABLE "submission_answers"
ADD COLUMN IF NOT EXISTS "last_audio_play_at" TIMESTAMPTZ(3);

-- 2. Ensure partial unique index for active student enrollment (1 student = at most 1 ACTIVE class)
CREATE UNIQUE INDEX IF NOT EXISTS "idx_unique_student_active_enrollment"
ON "enrollments"("student_id")
WHERE "status" = 'ACTIVE';

-- 3. Exclude temporary renumbering staging values (>= 200000) from lesson_sessions_class_active_num_unique
DROP INDEX IF EXISTS "lesson_sessions_class_active_num_unique";
CREATE UNIQUE INDEX "lesson_sessions_class_active_num_unique"
ON "lesson_sessions"("class_id", "session_number")
WHERE "session_number" IS NOT NULL AND "session_number" < 200000;
