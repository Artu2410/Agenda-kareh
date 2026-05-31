-- Add authorization type to ObraSocial for COKIBA sync classification
ALTER TABLE "ObraSocial"
ADD COLUMN "authorizationType" TEXT;
