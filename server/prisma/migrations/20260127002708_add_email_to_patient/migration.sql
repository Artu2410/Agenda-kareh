-- AlterTable
ALTER TABLE "Patient" ADD COLUMN     "email" TEXT;

-- CreateTable
CREATE TABLE "AgendaConfig" (
    "id" TEXT NOT NULL,
    "weekdayStartTime" TEXT NOT NULL,
    "weekdayEndTime" TEXT NOT NULL,
    "saturdayEnabled" BOOLEAN NOT NULL DEFAULT false,
    "saturdayStartTime" TEXT,
    "saturdayEndTime" TEXT,
    "slotDuration" INTEGER NOT NULL DEFAULT 30,
    "capacityPerSlot" INTEGER NOT NULL DEFAULT 5,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgendaConfig_pkey" PRIMARY KEY ("id")
);
