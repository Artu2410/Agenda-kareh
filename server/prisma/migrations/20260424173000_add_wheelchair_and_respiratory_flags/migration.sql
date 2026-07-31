-- AlterTable
ALTER TABLE "Patient" ADD COLUMN "usesWheelchair" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "isRespiratory" BOOLEAN NOT NULL DEFAULT false;
