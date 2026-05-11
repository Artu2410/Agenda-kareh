ALTER TABLE "Appointment"
ADD COLUMN "paidInAdvance" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "Appointment_paidInAdvance_date_idx" ON "Appointment"("paidInAdvance", "date");
