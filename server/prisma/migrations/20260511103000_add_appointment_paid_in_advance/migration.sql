ALTER TABLE "Appointment"
ADD COLUMN IF NOT EXISTS "paidInAdvance" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS "Appointment_paidInAdvance_date_idx" ON "Appointment"("paidInAdvance", "date");
