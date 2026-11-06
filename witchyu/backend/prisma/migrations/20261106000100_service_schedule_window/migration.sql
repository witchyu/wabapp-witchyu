-- Add per-service schedule configuration.
-- Existing services default to the normal shop schedule.
ALTER TABLE "Service"
  ADD COLUMN "scheduleMode" TEXT NOT NULL DEFAULT 'shop',
  ADD COLUMN "scheduleStartTime" TEXT,
  ADD COLUMN "scheduleEndTime" TEXT;
