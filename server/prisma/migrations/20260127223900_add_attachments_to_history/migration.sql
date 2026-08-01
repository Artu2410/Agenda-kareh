/*
  Warnings:

  - You are about to drop the column `medication` on the `ClinicalHistory` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "ClinicalHistory" DROP CONSTRAINT "ClinicalHistory_professionalId_fkey";

-- AlterTable
ALTER TABLE "ClinicalHistory" DROP COLUMN "medication",
ADD COLUMN     "attachments" TEXT,
ALTER COLUMN "professionalId" DROP NOT NULL,
ALTER COLUMN "diagnosis" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Patient" ADD COLUMN     "medicalNotes" TEXT;

-- AddForeignKey
ALTER TABLE "ClinicalHistory" ADD CONSTRAINT "ClinicalHistory_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "Professional"("id") ON DELETE SET NULL ON UPDATE CASCADE;
