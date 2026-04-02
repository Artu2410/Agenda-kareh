CREATE TABLE IF NOT EXISTS "InternalNote" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InternalNote_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "InternalNote_sortOrder_idx" ON "InternalNote"("sortOrder");
CREATE INDEX IF NOT EXISTS "InternalNote_updatedAt_idx" ON "InternalNote"("updatedAt");

CREATE TABLE IF NOT EXISTS "AgendaTimerState" (
  "id" TEXT NOT NULL,
  "timerDate" TEXT NOT NULL,
  "slotTime" TEXT NOT NULL,
  "slotNumber" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'idle',
  "durationSeconds" INTEGER NOT NULL,
  "remainingSeconds" INTEGER NOT NULL,
  "endsAt" TIMESTAMP(3),
  "finishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AgendaTimerState_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "AgendaTimerState_timerDate_slotTime_slotNumber_key"
ON "AgendaTimerState"("timerDate", "slotTime", "slotNumber");

CREATE INDEX IF NOT EXISTS "AgendaTimerState_timerDate_slotTime_idx"
ON "AgendaTimerState"("timerDate", "slotTime");
