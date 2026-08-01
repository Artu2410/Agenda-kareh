-- Create new role enum with the supported roles
CREATE TYPE "UserRole_new" AS ENUM ('SUPER_USER', 'ADMIN', 'PROFESSIONAL');

ALTER TABLE "User"
  ADD COLUMN "professionalId" TEXT;

ALTER TABLE "AuditLog"
  RENAME COLUMN "resource" TO "entityType";

ALTER TABLE "AuditLog"
  RENAME COLUMN "resourceId" TO "entityId";

ALTER TABLE "AuditLog"
  ADD COLUMN "oldValues" JSONB,
  ADD COLUMN "newValues" JSONB;

ALTER TABLE "Patient"
  ADD COLUMN "obraSocialId" TEXT;

ALTER TABLE "Appointment"
  ADD COLUMN "obraSocialId" TEXT,
  ADD COLUMN "authorizationStatus" TEXT NOT NULL DEFAULT 'NOT_REQUIRED',
  ADD COLUMN "authorizationNumber" TEXT,
  ADD COLUMN "authorizationFileUrl" TEXT,
  ADD COLUMN "authorizationReviewedAt" TIMESTAMP(3),
  ADD COLUMN "authorizationReviewedById" TEXT,
  ADD COLUMN "documentsChecklist" JSONB,
  ADD COLUMN "coinsuranceAmount" DECIMAL(10, 2),
  ADD COLUMN "patientChargeAmount" DECIMAL(10, 2),
  ADD COLUMN "coinsuranceDetails" JSONB;

ALTER TABLE "ObraSocial"
  ADD COLUMN "percentageCoinsurance" DECIMAL(5, 2) NOT NULL DEFAULT 0,
  ADD COLUMN "fixedCopay" DECIMAL(10, 2) NOT NULL DEFAULT 0,
  ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "requiresAuthorization" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "requiredDocuments" JSONB;

-- Backfill active flag from the existing estado field
UPDATE "ObraSocial"
SET "isActive" = CASE
  WHEN LOWER(COALESCE("estado", '')) = 'activa' THEN true
  ELSE false
END;

-- Backfill patient insurance relations when the names match
UPDATE "Patient" AS p
SET "obraSocialId" = os."id"
FROM "ObraSocial" AS os
WHERE p."obraSocialId" IS NULL
  AND p."healthInsurance" IS NOT NULL
  AND UPPER(TRIM(p."healthInsurance")) = UPPER(TRIM(os."nombreOs"));

-- Backfill appointment insurance from the patient record
UPDATE "Appointment" AS a
SET "obraSocialId" = p."obraSocialId"
FROM "Patient" AS p
WHERE a."patientId" = p."id"
  AND a."obraSocialId" IS NULL
  AND p."obraSocialId" IS NOT NULL;

-- Backfill legacy copay value into appointments with linked insurance
UPDATE "Appointment" AS a
SET
  "coinsuranceAmount" = os."coseguroValor",
  "patientChargeAmount" = os."coseguroValor"
FROM "ObraSocial" AS os
WHERE a."obraSocialId" = os."id"
  AND a."patientChargeAmount" IS NULL;

-- Migrate users to the new enum
ALTER TABLE "User"
  ALTER COLUMN "role" DROP DEFAULT;

ALTER TABLE "User"
  ALTER COLUMN "role" TYPE "UserRole_new"
  USING (
    CASE
      WHEN "role"::text = 'DOCTOR' THEN 'PROFESSIONAL'::"UserRole_new"
      WHEN "role"::text IN ('RECEPTIONIST', 'PATIENT') THEN 'ADMIN'::"UserRole_new"
      ELSE "role"::text::"UserRole_new"
    END
  );

DROP TYPE "UserRole";
ALTER TYPE "UserRole_new" RENAME TO "UserRole";

ALTER TABLE "User"
  ALTER COLUMN "role" SET DEFAULT 'ADMIN';

DROP INDEX IF EXISTS "AuditLog_resource_resourceId_idx";

CREATE UNIQUE INDEX "User_professionalId_key" ON "User"("professionalId");
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");
CREATE INDEX "Patient_obraSocialId_idx" ON "Patient"("obraSocialId");
CREATE INDEX "Appointment_obraSocialId_idx" ON "Appointment"("obraSocialId");
CREATE INDEX "Appointment_authorizationStatus_date_idx" ON "Appointment"("authorizationStatus", "date");
CREATE INDEX "ObraSocial_isActive_idx" ON "ObraSocial"("isActive");
CREATE INDEX "ObraSocial_requiresAuthorization_idx" ON "ObraSocial"("requiresAuthorization");

ALTER TABLE "User"
  ADD CONSTRAINT "User_professionalId_fkey"
  FOREIGN KEY ("professionalId") REFERENCES "Professional"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Patient"
  ADD CONSTRAINT "Patient_obraSocialId_fkey"
  FOREIGN KEY ("obraSocialId") REFERENCES "ObraSocial"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Appointment"
  ADD CONSTRAINT "Appointment_obraSocialId_fkey"
  FOREIGN KEY ("obraSocialId") REFERENCES "ObraSocial"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Appointment"
  ADD CONSTRAINT "Appointment_authorizationReviewedById_fkey"
  FOREIGN KEY ("authorizationReviewedById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
