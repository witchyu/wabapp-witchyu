-- Create enum types for fresh databases.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ManualQueueType') THEN
    CREATE TYPE "ManualQueueType" AS ENUM ('text', 'call');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ManualQueueStatus') THEN
    CREATE TYPE "ManualQueueStatus" AS ENUM ('available', 'full');
  END IF;
END $$;

-- Shared settings.
CREATE TABLE IF NOT EXISTS "ManualQueueSetting" (
  "id" INTEGER NOT NULL DEFAULT 1,
  "textTitle" TEXT NOT NULL DEFAULT 'คิวพิมพ์',
  "textDescription" TEXT NOT NULL DEFAULT 'จัดการเวลาสำหรับบริการแบบพิมพ์แชต',
  "callTitle" TEXT NOT NULL DEFAULT 'คิวโทร',
  "callDescription" TEXT NOT NULL DEFAULT 'จัดการเวลาสำหรับบริการแบบโทร',
  "showCall" BOOLEAN NOT NULL DEFAULT true,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ManualQueueSetting_pkey" PRIMARY KEY ("id")
);

-- Shared queue entries.
CREATE TABLE IF NOT EXISTS "ManualQueueEntry" (
  "id" TEXT NOT NULL,
  "type" "ManualQueueType" NOT NULL,
  "time" TEXT NOT NULL,
  "detail" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ManualQueueEntry_pkey" PRIMARY KEY ("id")
);

-- Per-date statuses.
CREATE TABLE IF NOT EXISTS "ManualQueueEntryStatus" (
  "id" TEXT NOT NULL,
  "entryId" TEXT NOT NULL,
  "date" TEXT NOT NULL,
  "status" "ManualQueueStatus" NOT NULL DEFAULT 'available',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ManualQueueEntryStatus_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ManualQueueEntryStatus_entryId_fkey"
    FOREIGN KEY ("entryId") REFERENCES "ManualQueueEntry"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

-- Required by ON CONFLICT during status migration.
CREATE UNIQUE INDEX IF NOT EXISTS "ManualQueueEntryStatus_entryId_date_key"
  ON "ManualQueueEntryStatus"("entryId", "date");

-- Migrate old per-day statuses.
DO $$
DECLARE
  old_count BIGINT;
  copied_count BIGINT;
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'ManualQueueEntry'
      AND column_name = 'dayId'
  ) THEN
    IF EXISTS (
      SELECT 1
      FROM "ManualQueueEntry"
      GROUP BY "type", "time"
      HAVING COUNT(*) > 1
    ) THEN
      RAISE EXCEPTION
        'Cannot migrate ManualQueue: duplicate (type,time) entries exist';
    END IF;

    SELECT COUNT(*) INTO old_count FROM "ManualQueueEntry";

    INSERT INTO "ManualQueueEntryStatus"
      ("id", "entryId", "date", "status", "createdAt", "updatedAt")
    SELECT
      gen_random_uuid()::text,
      e."id",
      d."date",
      e."status",
      e."createdAt",
      e."updatedAt"
    FROM "ManualQueueEntry" e
    JOIN "ManualQueueDay" d ON d."id" = e."dayId"
    ON CONFLICT ("entryId", "date") DO NOTHING;

    SELECT COUNT(*) INTO copied_count
    FROM "ManualQueueEntryStatus" s
    JOIN "ManualQueueEntry" e ON e."id" = s."entryId"
    JOIN "ManualQueueDay" d ON d."date" = s."date"
    WHERE EXISTS (
      SELECT 1
      FROM "ManualQueueEntry" old_entry
      WHERE old_entry."id" = s."entryId"
        AND old_entry."dayId" = d."id"
    );

    IF copied_count <> old_count THEN
      RAISE EXCEPTION
        'ManualQueue status migration incomplete: expected %, found %',
        old_count, copied_count;
    END IF;

    ALTER TABLE "ManualQueueEntry"
      DROP CONSTRAINT IF EXISTS "ManualQueueEntry_dayId_fkey";

    DROP INDEX IF EXISTS "ManualQueueEntry_dayId_status_idx";
    DROP INDEX IF EXISTS "ManualQueueEntry_dayId_type_time_key";

    ALTER TABLE "ManualQueueEntry"
      DROP COLUMN "dayId",
      DROP COLUMN "status";

    DROP TABLE IF EXISTS "ManualQueueDay";
  END IF;
END $$;

-- Final indexes.
CREATE UNIQUE INDEX IF NOT EXISTS "ManualQueueEntry_type_time_key"
  ON "ManualQueueEntry"("type", "time");

CREATE UNIQUE INDEX IF NOT EXISTS "ManualQueueEntryStatus_entryId_date_key"
  ON "ManualQueueEntryStatus"("entryId", "date");

CREATE INDEX IF NOT EXISTS "ManualQueueEntryStatus_date_status_idx"
  ON "ManualQueueEntryStatus"("date", "status");
