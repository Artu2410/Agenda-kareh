DO $$
BEGIN
  CREATE TYPE "BillingPayerType" AS ENUM ('PATIENT', 'OBRA_SOCIAL', 'OTHER');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "BillingInvoiceStatus" AS ENUM ('DRAFT', 'ISSUED', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'CANCELLED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "BillingInvoice" (
  "id" TEXT NOT NULL,
  "invoiceNumber" TEXT,
  "payerType" "BillingPayerType" NOT NULL DEFAULT 'OBRA_SOCIAL',
  "payerName" TEXT NOT NULL,
  "obraSocialId" TEXT,
  "patientId" TEXT,
  "issueDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "serviceMonth" TEXT,
  "dueDate" TIMESTAMP(3),
  "expectedPaymentDate" TIMESTAMP(3),
  "totalAmount" DECIMAL(10,2) NOT NULL,
  "paidAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "status" "BillingInvoiceStatus" NOT NULL DEFAULT 'ISSUED',
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BillingInvoice_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "BillingInvoiceItem" (
  "id" TEXT NOT NULL,
  "invoiceId" TEXT NOT NULL,
  "appointmentId" TEXT,
  "patientId" TEXT,
  "professionalId" TEXT,
  "serviceDate" TIMESTAMP(3),
  "description" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL DEFAULT 1,
  "unitAmount" DECIMAL(10,2) NOT NULL,
  "totalAmount" DECIMAL(10,2) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BillingInvoiceItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "BillingPayment" (
  "id" TEXT NOT NULL,
  "invoiceId" TEXT NOT NULL,
  "amount" DECIMAL(10,2) NOT NULL,
  "paymentDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "paymentMethod" TEXT NOT NULL,
  "account" TEXT NOT NULL DEFAULT 'MERCADO_PAGO',
  "notes" TEXT,
  "cashFlowId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BillingPayment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "BillingInvoice_invoiceNumber_key" ON "BillingInvoice"("invoiceNumber");
CREATE INDEX IF NOT EXISTS "BillingInvoice_payerType_idx" ON "BillingInvoice"("payerType");
CREATE INDEX IF NOT EXISTS "BillingInvoice_obraSocialId_idx" ON "BillingInvoice"("obraSocialId");
CREATE INDEX IF NOT EXISTS "BillingInvoice_patientId_idx" ON "BillingInvoice"("patientId");
CREATE INDEX IF NOT EXISTS "BillingInvoice_issueDate_idx" ON "BillingInvoice"("issueDate");
CREATE INDEX IF NOT EXISTS "BillingInvoice_expectedPaymentDate_idx" ON "BillingInvoice"("expectedPaymentDate");
CREATE INDEX IF NOT EXISTS "BillingInvoice_status_idx" ON "BillingInvoice"("status");

CREATE INDEX IF NOT EXISTS "BillingInvoiceItem_invoiceId_idx" ON "BillingInvoiceItem"("invoiceId");
CREATE UNIQUE INDEX IF NOT EXISTS "BillingInvoiceItem_appointmentId_key" ON "BillingInvoiceItem"("appointmentId");
CREATE INDEX IF NOT EXISTS "BillingInvoiceItem_patientId_idx" ON "BillingInvoiceItem"("patientId");
CREATE INDEX IF NOT EXISTS "BillingInvoiceItem_professionalId_idx" ON "BillingInvoiceItem"("professionalId");
CREATE INDEX IF NOT EXISTS "BillingInvoiceItem_serviceDate_idx" ON "BillingInvoiceItem"("serviceDate");

CREATE UNIQUE INDEX IF NOT EXISTS "BillingPayment_cashFlowId_key" ON "BillingPayment"("cashFlowId");
CREATE INDEX IF NOT EXISTS "BillingPayment_invoiceId_idx" ON "BillingPayment"("invoiceId");
CREATE INDEX IF NOT EXISTS "BillingPayment_paymentDate_idx" ON "BillingPayment"("paymentDate");

ALTER TABLE "BillingInvoice"
  ADD CONSTRAINT "BillingInvoice_obraSocialId_fkey"
  FOREIGN KEY ("obraSocialId") REFERENCES "ObraSocial"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "BillingInvoice"
  ADD CONSTRAINT "BillingInvoice_patientId_fkey"
  FOREIGN KEY ("patientId") REFERENCES "Patient"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "BillingInvoiceItem"
  ADD CONSTRAINT "BillingInvoiceItem_invoiceId_fkey"
  FOREIGN KEY ("invoiceId") REFERENCES "BillingInvoice"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BillingInvoiceItem"
  ADD CONSTRAINT "BillingInvoiceItem_appointmentId_fkey"
  FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "BillingInvoiceItem"
  ADD CONSTRAINT "BillingInvoiceItem_patientId_fkey"
  FOREIGN KEY ("patientId") REFERENCES "Patient"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "BillingInvoiceItem"
  ADD CONSTRAINT "BillingInvoiceItem_professionalId_fkey"
  FOREIGN KEY ("professionalId") REFERENCES "Professional"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "BillingPayment"
  ADD CONSTRAINT "BillingPayment_invoiceId_fkey"
  FOREIGN KEY ("invoiceId") REFERENCES "BillingInvoice"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BillingPayment"
  ADD CONSTRAINT "BillingPayment_cashFlowId_fkey"
  FOREIGN KEY ("cashFlowId") REFERENCES "CashFlow"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
