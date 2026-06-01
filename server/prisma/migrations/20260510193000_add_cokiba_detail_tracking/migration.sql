ALTER TABLE "ObraSocial"
ADD COLUMN IF NOT EXISTS "detectedStatus" TEXT,
ADD COLUMN IF NOT EXISTS "detectedIsActive" BOOLEAN,
ADD COLUMN IF NOT EXISTS "statusManualOverride" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "cokibaDetails" JSONB;

UPDATE "ObraSocial"
SET
  "detectedStatus" = COALESCE(NULLIF("estado", ''), CASE WHEN "isActive" THEN 'Activa' ELSE 'Inactiva' END),
  "detectedIsActive" = "isActive"
WHERE "detectedStatus" IS NULL
   OR "detectedIsActive" IS NULL;
