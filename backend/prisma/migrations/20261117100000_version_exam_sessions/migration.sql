ALTER TABLE "submissions"
  ADD COLUMN "revision" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "timer_accounted_at" TIMESTAMPTZ(3),
  ADD COLUMN "timer_lease_until" TIMESTAMPTZ(3),
  ADD COLUMN "timer_client_id" TEXT;
