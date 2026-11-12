-- Phase 5 Question Bank & Import Schema Migration
-- Creates assessments, questions, media_assets, question_media tables + enums.

-- CreateEnum
CREATE TYPE "AssessmentType" AS ENUM ('HOMEWORK', 'MINI_TEST', 'MIDTERM', 'FINAL');

-- CreateEnum
CREATE TYPE "AssessmentStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "QuestionType" AS ENUM ('SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'FILL_BLANK', 'ORDERING', 'ESSAY', 'LISTENING', 'IMAGE_BASED');

-- CreateEnum
CREATE TYPE "MediaKind" AS ENUM ('AUDIO', 'IMAGE');

-- CreateTable
CREATE TABLE "assessments" (
    "id" TEXT NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "type" "AssessmentType" NOT NULL,
    "course_id" TEXT NOT NULL,
    "duration_minutes" INTEGER,
    "status" "AssessmentStatus" NOT NULL DEFAULT 'DRAFT',
    "is_locked" BOOLEAN NOT NULL DEFAULT false,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "assessments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "questions" (
    "id" TEXT NOT NULL,
    "assessment_id" TEXT NOT NULL,
    "type" "QuestionType" NOT NULL,
    "position" INTEGER NOT NULL,
    "prompt" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "points" DOUBLE PRECISION NOT NULL,
    "needs_review" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_assets" (
    "id" TEXT NOT NULL,
    "kind" "MediaKind" NOT NULL,
    "mime" VARCHAR(100) NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "storage_key" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "media_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "question_media" (
    "question_id" TEXT NOT NULL,
    "media_asset_id" TEXT NOT NULL,
    "role" VARCHAR(30) NOT NULL
);

-- CreateIndex
CREATE INDEX "assessments_course_id_status_idx" ON "assessments"("course_id", "status");

-- CreateIndex
CREATE INDEX "assessments_created_by_id_idx" ON "assessments"("created_by_id");

-- CreateIndex
CREATE INDEX "questions_assessment_id_idx" ON "questions"("assessment_id");

-- CreateIndex
CREATE UNIQUE INDEX "questions_assessment_id_position_key" ON "questions"("assessment_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "media_assets_storage_key_key" ON "media_assets"("storage_key");

-- CreateIndex
CREATE UNIQUE INDEX "question_media_pkey" ON "question_media"("question_id", "media_asset_id");

-- AddForeignKey
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_assessment_id_fkey" FOREIGN KEY ("assessment_id") REFERENCES "assessments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_media" ADD CONSTRAINT "question_media_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_media" ADD CONSTRAINT "question_media_media_asset_id_fkey" FOREIGN KEY ("media_asset_id") REFERENCES "media_assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Data integrity: question points must be positive, position >= 1
ALTER TABLE "questions" ADD CONSTRAINT "questions_points_positive" CHECK ("points" > 0);
ALTER TABLE "questions" ADD CONSTRAINT "questions_position_positive" CHECK ("position" >= 1);
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_size_positive" CHECK ("size_bytes" > 0);
