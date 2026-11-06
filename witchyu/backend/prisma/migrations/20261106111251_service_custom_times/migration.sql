-- CreateTable
CREATE TABLE "ServiceTime" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "time" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServiceTime_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ServiceTime_serviceId_active_idx" ON "ServiceTime"("serviceId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceTime_serviceId_time_key" ON "ServiceTime"("serviceId", "time");

-- AddForeignKey
ALTER TABLE "ServiceTime" ADD CONSTRAINT "ServiceTime_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;
