-- Acelera la carga de la historia clinica de cada paciente.
CREATE INDEX IF NOT EXISTS "ClinicalHistory_patientId_date_idx" ON "ClinicalHistory"("patientId", "date");
