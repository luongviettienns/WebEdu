-- Link media assets to an assessment so extra audio/images (FUNC-040/049)
-- can be reused across questions.

ALTER TABLE "media_assets"
  ADD COLUMN "assessment_id" TEXT;

CREATE INDEX "media_assets_assessment_id_idx" ON "media_assets"("assessment_id");

ALTER TABLE "media_assets"
  ADD CONSTRAINT "media_assets_assessment_id_fkey"
  FOREIGN KEY ("assessment_id") REFERENCES "assessments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
