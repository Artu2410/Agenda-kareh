ALTER TABLE "ObraSocial"
ADD COLUMN IF NOT EXISTS "isArchived" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS "ObraSocial_isArchived_idx" ON "ObraSocial"("isArchived");
