/*
  Warnings:

  - You are about to drop the column `hasPacemaker` on the `Patient` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Appointment" ADD COLUMN     "diagnosis" TEXT;

-- AlterTable
ALTER TABLE "Patient" DROP COLUMN "hasPacemaker",
ADD COLUMN     "hasMarcapasos" BOOLEAN NOT NULL DEFAULT false;
