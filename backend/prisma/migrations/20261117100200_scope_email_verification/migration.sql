ALTER TABLE "email_verifications" ADD COLUMN "scope" VARCHAR(80) NOT NULL DEFAULT 'registration';
UPDATE "email_verifications"
SET "expires_at" = LEAST("expires_at", CURRENT_TIMESTAMP)
WHERE "verified_at" IS NULL;
DROP INDEX "email_verifications_email_created_at_idx";
CREATE INDEX "email_verifications_email_scope_created_at_idx"
ON "email_verifications" ("email", "scope", "created_at" DESC);
