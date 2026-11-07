-- CreateTable
CREATE TABLE IF NOT EXISTS "auth_rate_limits" (
    "key" VARCHAR(128) NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 1,
    "last_attempt_at" TIMESTAMPTZ(3) NOT NULL,
    "blocked_until" TIMESTAMPTZ(3),

    CONSTRAINT "auth_rate_limits_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "auth_rate_limits_last_attempt_at_idx" ON "auth_rate_limits"("last_attempt_at");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "email_rate_limits_last_requested_at_idx" ON "email_rate_limits"("last_requested_at");
