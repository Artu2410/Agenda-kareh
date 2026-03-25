CREATE SEQUENCE "Patient_clinicalRecordNumber_seq";

ALTER TABLE "Patient"
ADD COLUMN "clinicalRecordNumber" INTEGER;

ALTER TABLE "Patient"
ALTER COLUMN "clinicalRecordNumber" SET DEFAULT nextval('"Patient_clinicalRecordNumber_seq"');

UPDATE "Patient"
SET "clinicalRecordNumber" = nextval('"Patient_clinicalRecordNumber_seq"')
WHERE "clinicalRecordNumber" IS NULL;

ALTER TABLE "Patient"
ALTER COLUMN "clinicalRecordNumber" SET NOT NULL;

CREATE UNIQUE INDEX "Patient_clinicalRecordNumber_key" ON "Patient"("clinicalRecordNumber");
