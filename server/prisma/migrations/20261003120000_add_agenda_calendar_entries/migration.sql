CREATE TYPE "AgendaCalendarEntryType" AS ENUM (
  'CLINIC_CLOSURE',
  'SCHEDULE_EXCEPTION'
);

CREATE TABLE "AgendaCalendarEntry" (
  "id" TEXT NOT NULL,
  "date" VARCHAR(10) NOT NULL,
  "name" TEXT NOT NULL,
  "type" "AgendaCalendarEntryType" NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "isOperational" BOOLEAN NOT NULL DEFAULT false,
  "professionalId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AgendaCalendarEntry_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AgendaCalendarEntry_date_isActive_idx"
  ON "AgendaCalendarEntry"("date", "isActive");
CREATE INDEX "AgendaCalendarEntry_professionalId_date_isActive_idx"
  ON "AgendaCalendarEntry"("professionalId", "date", "isActive");

ALTER TABLE "AgendaCalendarEntry"
  ADD CONSTRAINT "AgendaCalendarEntry_professionalId_fkey"
  FOREIGN KEY ("professionalId") REFERENCES "Professional"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;