/*
  Warnings:

  - You are about to drop the column `scheduleEndTime` on the `Service` table. All the data in the column will be lost.
  - You are about to drop the column `scheduleStartTime` on the `Service` table. All the data in the column will be lost.
  - You are about to drop the column `unlimited` on the `Service` table. All the data in the column will be lost.
  - You are about to drop the column `unlimited` on the `TimeSlot` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Service" DROP COLUMN "scheduleEndTime",
DROP COLUMN "scheduleStartTime",
DROP COLUMN "unlimited";

-- AlterTable
ALTER TABLE "TimeSlot" DROP COLUMN "unlimited";
