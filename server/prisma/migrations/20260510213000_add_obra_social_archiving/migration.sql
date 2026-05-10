ALTER TABLE "ObraSocial"
ADD COLUMN "isArchived" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "ObraSocial_isArchived_idx" ON "ObraSocial"("isArchived");
