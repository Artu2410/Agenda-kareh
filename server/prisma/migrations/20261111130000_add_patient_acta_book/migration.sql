-- Marca de pacientes ya pasados al libro de actas físico
ALTER TABLE "Patient" ADD COLUMN "actaBookRecordedAt" TIMESTAMP(3);
ALTER TABLE "Patient" ADD COLUMN "actaBookFolio" TEXT;

CREATE INDEX "Patient_actaBookRecordedAt_idx" ON "Patient"("actaBookRecordedAt");
