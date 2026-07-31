-- CreateTable
CREATE TABLE "ObraSocial" (
    "id" TEXT NOT NULL,
    "codigoCokiba" TEXT NOT NULL,
    "nombreOs" TEXT NOT NULL,
    "coseguroValor" DECIMAL(10,2) NOT NULL,
    "honorarioEstimado" DECIMAL(10,2) NOT NULL,
    "plazoPago" INTEGER NOT NULL DEFAULT 60,
    "estado" TEXT NOT NULL DEFAULT 'Activa',
    "atendibleSanMiguel" BOOLEAN NOT NULL DEFAULT false,
    "rawCategoria" TEXT,
    "ultimaSync" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ObraSocial_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ObraSocial_codigoCokiba_key" ON "ObraSocial"("codigoCokiba");

-- CreateIndex
CREATE INDEX "ObraSocial_estado_idx" ON "ObraSocial"("estado");

-- CreateIndex
CREATE INDEX "ObraSocial_nombreOs_idx" ON "ObraSocial"("nombreOs");
