-- Phase 3 Courses & Classes Schema Extension
-- Adds recurring schedule metadata & closure fields to classes
-- and creates class_teacher_assignments for teacher handover history.

-- AlterTable
ALTER TABLE "classes"
    ADD COLUMN "schedule_days" INTEGER[] NOT NULL DEFAULT ARRAY[1, 3, 5]::INTEGER[],
    ADD COLUMN "schedule_start_time" VARCHAR(5) NOT NULL DEFAULT '18:00',
    ADD COLUMN "schedule_end_time" VARCHAR(5) NOT NULL DEFAULT '19:30',
    ADD COLUMN "closed_reason" VARCHAR(255),
    ADD COLUMN "closed_at" TIMESTAMPTZ(3);

-- CreateTable
CREATE TABLE "class_teacher_assignments" (
    "id" TEXT NOT NULL,
    "class_id" TEXT NOT NULL,
    "teacher_id" TEXT NOT NULL,
    "assigned_from" DATE NOT NULL,
    "assigned_to" DATE,
    "changed_by_id" TEXT,
    "reason" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "class_teacher_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "class_teacher_assignments_class_id_assigned_from_idx" ON "class_teacher_assignments"("class_id", "assigned_from" DESC);

-- CreateIndex
CREATE INDEX "class_teacher_assignments_teacher_id_idx" ON "class_teacher_assignments"("teacher_id");

-- AddForeignKey
ALTER TABLE "class_teacher_assignments" ADD CONSTRAINT "class_teacher_assignments_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_teacher_assignments" ADD CONSTRAINT "class_teacher_assignments_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_teacher_assignments" ADD CONSTRAINT "class_teacher_assignments_changed_by_id_fkey" FOREIGN KEY ("changed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill initial teacher assignment history for pre-existing classes
INSERT INTO "class_teacher_assignments" (
    "id",
    "class_id",
    "teacher_id",
    "assigned_from",
    "assigned_to",
    "reason",
    "created_at"
)
SELECT
    gen_random_uuid()::text,
    c."id",
    c."teacher_id",
    c."start_date",
    CASE
        WHEN c."status" IN ('COMPLETED', 'ARCHIVED') THEN COALESCE(c."actual_end_date", c."expected_end_date", c."start_date")
        ELSE NULL
    END,
    'Khởi tạo lịch sử phân công giáo viên ban đầu từ dữ liệu lớp học hiện có',
    CURRENT_TIMESTAMP
FROM "classes" c
WHERE c."teacher_id" IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM "class_teacher_assignments" cta
      WHERE cta."class_id" = c."id"
  );

-- CreateIndex: Enforce at most one currently active teacher assignment per class
CREATE UNIQUE INDEX "class_teacher_assignments_active_unique_idx"
    ON "class_teacher_assignments"("class_id")
    WHERE "assigned_to" IS NULL;
