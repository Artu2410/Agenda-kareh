-- Safe backfill for Patient.birthDate and updatedAt on non-empty tables
ALTER TABLE "Patient" ADD COLUMN IF NOT EXISTS "birthDate" TIMESTAMP(3);
ALTER TABLE "Patient" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3);

UPDATE "Patient"
SET "birthDate" = TIMESTAMP '1900-01-01 12:00:00'
WHERE "birthDate" IS NULL;

UPDATE "Patient"
SET "updatedAt" = NOW()
WHERE "updatedAt" IS NULL;

ALTER TABLE "Patient" ALTER COLUMN "birthDate" SET NOT NULL;
ALTER TABLE "Patient" ALTER COLUMN "updatedAt" SET NOT NULL;
