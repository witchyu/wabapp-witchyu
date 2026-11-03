ALTER TABLE "TimeSlot"
ADD COLUMN "endTime" TEXT,
ADD COLUMN "isLastSlot" BOOLEAN NOT NULL DEFAULT false;

UPDATE "TimeSlot" AS slot
SET
  "endTime" = TO_CHAR(
    (slot."time"::time + INTERVAL '60 minutes'),
    'HH24:MI'
  ),
  "isLastSlot" = (
    slot."time" = (
      SELECT MAX("time") FROM "TimeSlot"
    )
  );

ALTER TABLE "TimeSlot"
ALTER COLUMN "endTime" SET NOT NULL;

ALTER TABLE "TimeSlot"
DROP COLUMN "capacity";
