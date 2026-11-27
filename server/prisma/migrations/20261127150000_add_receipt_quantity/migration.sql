-- Cantidad y precio unitario del comprobante no fiscal (no modifica datos existentes).
-- "amount" sigue siendo el total a abonar; los comprobantes viejos quedan como 1 × monto.
ALTER TABLE "PatientReceipt"
ADD COLUMN IF NOT EXISTS "quantity" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "PatientReceipt"
ADD COLUMN IF NOT EXISTS "unitPrice" DECIMAL(12,2);
