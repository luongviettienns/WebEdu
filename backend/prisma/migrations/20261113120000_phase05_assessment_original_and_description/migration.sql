-- Phase 5 close-out: optional description + original import file for FUNC-039/040/042.

ALTER TABLE "assessments"
  ADD COLUMN "description" VARCHAR(2000),
  ADD COLUMN "original_file_name" VARCHAR(255),
  ADD COLUMN "original_storage_key" VARCHAR(255);
