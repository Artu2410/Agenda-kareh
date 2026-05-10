ALTER TABLE "ObraSocial"
ADD COLUMN "detectedStatus" TEXT,
ADD COLUMN "detectedIsActive" BOOLEAN,
ADD COLUMN "statusManualOverride" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "cokibaDetails" JSONB;

UPDATE "ObraSocial"
SET
  "detectedStatus" = COALESCE(NULLIF("estado", ''), CASE WHEN "isActive" THEN 'Activa' ELSE 'Inactiva' END),
  "detectedIsActive" = "isActive"
WHERE "detectedStatus" IS NULL
   OR "detectedIsActive" IS NULL;
