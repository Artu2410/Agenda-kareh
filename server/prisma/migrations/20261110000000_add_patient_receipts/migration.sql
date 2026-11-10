-- Comprobantes no fiscales (no válidos como factura ante ARCA)
CREATE TABLE "PatientReceipt" (
    "id" TEXT NOT NULL,
    "number" SERIAL NOT NULL,
    "issueDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "patientId" TEXT NOT NULL,
    "professionalId" TEXT,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "patientName" TEXT NOT NULL,
    "patientDni" TEXT NOT NULL,
    "coverage" TEXT,
    "affiliateNumber" TEXT,
    "diagnosis" TEXT,
    "professionalName" TEXT,
    "professionalLicense" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PatientReceipt_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PatientReceipt_number_key" ON "PatientReceipt"("number");
CREATE INDEX "PatientReceipt_patientId_issueDate_idx" ON "PatientReceipt"("patientId", "issueDate");
CREATE INDEX "PatientReceipt_issueDate_idx" ON "PatientReceipt"("issueDate");

ALTER TABLE "PatientReceipt" ADD CONSTRAINT "PatientReceipt_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PatientReceipt" ADD CONSTRAINT "PatientReceipt_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "Professional"("id") ON DELETE SET NULL ON UPDATE CASCADE;
