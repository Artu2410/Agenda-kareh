-- Add authorization type to ObraSocial for COKIBA sync classification
ALTER TABLE "ObraSocial"
ADD COLUMN IF NOT EXISTS "authorizationType" TEXT;
