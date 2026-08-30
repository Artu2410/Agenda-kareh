/*
  Warnings:

  - You are about to drop the column `whatsappReminderSentAt` on the `Appointment` table. All the data in the column will be lost.
  - You are about to drop the column `whatsappTicketSentAt` on the `Appointment` table. All the data in the column will be lost.
  - You are about to drop the `WhatsAppConversation` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `WhatsAppMessage` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "ProfessionalType" AS ENUM ('MN', 'MP');

-- DropForeignKey
ALTER TABLE "WhatsAppMessage" DROP CONSTRAINT "WhatsAppMessage_conversationId_fkey";

-- AlterTable
ALTER TABLE "AgendaTimerState" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Appointment" DROP COLUMN "whatsappReminderSentAt",
DROP COLUMN "whatsappTicketSentAt";

-- AlterTable
ALTER TABLE "BillingInvoice" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "InternalNote" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "ObraSocial" ADD COLUMN     "allowedPlans" JSONB,
ADD COLUMN     "billingMethod" TEXT,
ADD COLUMN     "copaymentAmount" DECIMAL(10,2),
ADD COLUMN     "copaymentRequired" BOOLEAN DEFAULT false,
ADD COLUMN     "honorarium" DECIMAL(10,2),
ADD COLUMN     "logoUrl" TEXT,
ADD COLUMN     "normalizedData" JSONB,
ADD COLUMN     "paymentDays" INTEGER;

-- AlterTable
ALTER TABLE "Professional" ADD COLUMN     "isArchived" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "type" "ProfessionalType" NOT NULL DEFAULT 'MN';

-- DropTable
DROP TABLE "WhatsAppConversation";

-- DropTable
DROP TABLE "WhatsAppMessage";

-- CreateTable
CREATE TABLE "PushSubscription" (
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
CREATE UNIQUE INDEX "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");

-- CreateIndex
CREATE INDEX "Appointment_date_idx" ON "Appointment"("date");

-- CreateIndex
CREATE INDEX "Appointment_professionalId_date_idx" ON "Appointment"("professionalId", "date");

-- CreateIndex
CREATE INDEX "Appointment_patientId_idx" ON "Appointment"("patientId");

-- CreateIndex
CREATE INDEX "Patient_phone_idx" ON "Patient"("phone");
