/*
  Warnings:

  - You are about to drop the column `whatsappReminderSentAt` on the `Appointment` table. All the data in the column will be lost.
  - You are about to drop the column `whatsappTicketSentAt` on the `Appointment` table. All the data in the column will be lost.
  - You are about to drop the `WhatsAppConversation` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `WhatsAppMessage` table. If the table is not empty, all the data it contains will be lost.

*/
-- Keep this recovery migration safe for databases that already contain part
-- of the local schema changes. Existing WhatsApp data is intentionally kept.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_type t
        JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE t.typname = 'ProfessionalType' AND n.nspname = 'public'
    ) THEN
        CREATE TYPE "ProfessionalType" AS ENUM ('MN', 'MP');
    END IF;
END $$;

-- AlterTable
ALTER TABLE "AgendaTimerState" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
-- WhatsApp columns and tables may still contain production data, so they are
-- left in place even though they are no longer part of the Prisma schema.

-- AlterTable
ALTER TABLE "BillingInvoice" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "InternalNote" ALTER COLUMN "updatedAt" DROP DEFAULT;

ALTER TABLE "ObraSocial" ADD COLUMN IF NOT EXISTS "allowedPlans" JSONB;
ALTER TABLE "ObraSocial" ADD COLUMN IF NOT EXISTS "billingMethod" TEXT;
ALTER TABLE "ObraSocial" ADD COLUMN IF NOT EXISTS "copaymentAmount" DECIMAL(10,2);
ALTER TABLE "ObraSocial" ADD COLUMN IF NOT EXISTS "copaymentRequired" BOOLEAN DEFAULT false;
ALTER TABLE "ObraSocial" ADD COLUMN IF NOT EXISTS "honorarium" DECIMAL(10,2);
ALTER TABLE "ObraSocial" ADD COLUMN IF NOT EXISTS "logoUrl" TEXT;
ALTER TABLE "ObraSocial" ADD COLUMN IF NOT EXISTS "normalizedData" JSONB;
ALTER TABLE "ObraSocial" ADD COLUMN IF NOT EXISTS "paymentDays" INTEGER;

-- AlterTable
ALTER TABLE "Professional" ADD COLUMN IF NOT EXISTS "isArchived" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Professional" ADD COLUMN IF NOT EXISTS "type" "ProfessionalType" NOT NULL DEFAULT 'MN';

-- CreateTable
CREATE TABLE IF NOT EXISTS "PushSubscription" (
    "id" TEXT NOT NULL,
    "email" TEXT,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Appointment_date_idx" ON "Appointment"("date");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Appointment_professionalId_date_idx" ON "Appointment"("professionalId", "date");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Appointment_patientId_idx" ON "Appointment"("patientId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Patient_phone_idx" ON "Patient"("phone");
