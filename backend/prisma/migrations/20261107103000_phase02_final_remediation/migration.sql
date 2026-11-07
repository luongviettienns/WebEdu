-- Phase 2 Final Remediation & Forward-Compatible Phase 3 Enrollment Foundation
-- Enforces:
-- 1. Persistent multi-instance forgot-password cooldowns (email_rate_limits)
-- 2. Forward-compatible Course -> Class -> Enrollment relations (FUNC-008, DEC-006, DEC-007, DEC-024, DEC-025)
-- 3. PostgreSQL Partial Unique Index idx_unique_student_active_enrollment (1 Student = at most 1 ACTIVE Class)
-- 4. Query performance indexes for multi-role array filtering and pagination

-- CreateEnum
CREATE TYPE "CourseLevel" AS ENUM ('HSK1', 'HSK2', 'HSK3', 'HSK4', 'BASIC_COMMUNICATION');

-- CreateEnum
CREATE TYPE "ClassStatus" AS ENUM ('UPCOMING', 'ACTIVE', 'COMPLETED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "EnrollmentStatus" AS ENUM ('ACTIVE', 'TRANSFERRED', 'DROPPED', 'COMPLETED');

-- AlterTable
ALTER TABLE "student_profiles" ADD COLUMN "current_class_id" TEXT;

-- CreateTable
CREATE TABLE "email_rate_limits" (
    "email_hash" VARCHAR(64) NOT NULL,
    "last_requested_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "email_rate_limits_pkey" PRIMARY KEY ("email_hash")
);

-- CreateTable
CREATE TABLE "courses" (
    "id" TEXT NOT NULL,
    "code" VARCHAR(30) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "level" "CourseLevel" NOT NULL,
    "default_sessions" INTEGER,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "courses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "classes" (
    "id" TEXT NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "course_id" TEXT NOT NULL,
    "teacher_id" TEXT NOT NULL,
    "status" "ClassStatus" NOT NULL DEFAULT 'UPCOMING',
    "start_date" DATE NOT NULL,
    "total_sessions" INTEGER NOT NULL DEFAULT 24,
    "expected_end_date" DATE,
    "actual_end_date" DATE,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "classes_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "classes_total_sessions_positive_chk" CHECK ("total_sessions" > 0)
);

-- CreateTable
CREATE TABLE "enrollments" (
    "id" TEXT NOT NULL,
    "class_id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "status" "EnrollmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "enrolled_date" DATE NOT NULL,
    "left_date" DATE,
    "reason" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "enrollments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "users_created_at_idx" ON "users"("created_at" DESC);

-- CreateIndex
CREATE INDEX "users_full_name_idx" ON "users"("full_name");

-- CreateIndex (PostgreSQL GIN index for Role[] array containment queries)
CREATE INDEX "users_roles_gin_idx" ON "users" USING GIN ("roles");

-- CreateIndex
CREATE INDEX "student_profiles_assigned_class_idx" ON "student_profiles"("assigned_class");

-- CreateIndex
CREATE INDEX "student_profiles_current_class_id_idx" ON "student_profiles"("current_class_id");

-- CreateIndex
CREATE UNIQUE INDEX "courses_code_key" ON "courses"("code");

-- CreateIndex
CREATE INDEX "courses_is_active_level_idx" ON "courses"("is_active", "level");

-- CreateIndex
CREATE UNIQUE INDEX "classes_code_key" ON "classes"("code");

-- CreateIndex
CREATE INDEX "classes_teacher_id_status_idx" ON "classes"("teacher_id", "status");

-- CreateIndex
CREATE INDEX "classes_course_id_idx" ON "classes"("course_id");

-- CreateIndex
CREATE INDEX "classes_status_idx" ON "classes"("status");

-- CreateIndex
CREATE INDEX "enrollments_class_id_status_idx" ON "enrollments"("class_id", "status");

-- CreateIndex
CREATE INDEX "enrollments_student_id_status_idx" ON "enrollments"("student_id", "status");

-- CreateIndex (Architecture Decision Contract Invariant #1: 1 Student = at most 1 ACTIVE Class)
CREATE UNIQUE INDEX "idx_unique_student_active_enrollment" ON "enrollments"("student_id") WHERE "status" = 'ACTIVE';

-- AddForeignKey
ALTER TABLE "student_profiles" ADD CONSTRAINT "student_profiles_current_class_id_fkey" FOREIGN KEY ("current_class_id") REFERENCES "classes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "classes" ADD CONSTRAINT "classes_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "classes" ADD CONSTRAINT "classes_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
