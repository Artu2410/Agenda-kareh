-- Informes kinésicos guardados en la historia clínica del paciente
CREATE TABLE "PatientReport" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "professionalId" TEXT,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "reportDate" TIMESTAMP(3) NOT NULL,
    "data" JSONB NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PatientReport_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PatientReport_patientId_reportDate_idx" ON "PatientReport"("patientId", "reportDate");

ALTER TABLE "PatientReport" ADD CONSTRAINT "PatientReport_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PatientReport" ADD CONSTRAINT "PatientReport_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "Professional"("id") ON DELETE SET NULL ON UPDATE CASCADE;
