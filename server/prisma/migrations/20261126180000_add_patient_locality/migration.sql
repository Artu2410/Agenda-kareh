-- Localidad del domicilio del paciente (opcional; no modifica datos existentes).
ALTER TABLE "Patient"
ADD COLUMN IF NOT EXISTS "locality" TEXT;
