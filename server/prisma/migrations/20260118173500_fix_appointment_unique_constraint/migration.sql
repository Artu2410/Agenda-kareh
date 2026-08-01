/*
  Warnings:

  - A unique constraint covering the columns `[date,time,slotNumber,professionalId]` on the table `Appointment` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "Appointment_date_time_slotNumber_key";

-- CreateIndex
CREATE UNIQUE INDEX "Appointment_date_time_slotNumber_professionalId_key" ON "Appointment"("date", "time", "slotNumber", "professionalId");
