-- Ensure affiliateNumber exists (repair migration for production baseline)
ALTER TABLE "Patient" ADD COLUMN IF NOT EXISTS "affiliateNumber" TEXT;
