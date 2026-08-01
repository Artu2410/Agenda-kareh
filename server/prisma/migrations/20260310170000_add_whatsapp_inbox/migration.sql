CREATE TABLE IF NOT EXISTS "WhatsAppConversation" (
  "id" TEXT NOT NULL,
  "waId" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "profileName" TEXT,
  "lastMessageAt" TIMESTAMP(3),
  "lastMessageText" TEXT,
  "unreadCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WhatsAppConversation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "WhatsAppMessage" (
  "id" TEXT NOT NULL,
  "conversationId" TEXT NOT NULL,
  "direction" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "text" TEXT,
  "mediaUrl" TEXT,
  "mediaMime" TEXT,
  "mediaSha256" TEXT,
  "mediaName" TEXT,
  "waMessageId" TEXT,
  "status" TEXT,
  "statusAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WhatsAppMessage_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'WhatsAppMessage_conversationId_fkey'
  ) THEN
    ALTER TABLE "WhatsAppMessage" ADD CONSTRAINT "WhatsAppMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "WhatsAppConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "WhatsAppConversation_waId_key" ON "WhatsAppConversation"("waId");
CREATE UNIQUE INDEX IF NOT EXISTS "WhatsAppMessage_waMessageId_key" ON "WhatsAppMessage"("waMessageId");
CREATE INDEX IF NOT EXISTS "WhatsAppMessage_conversationId_idx" ON "WhatsAppMessage"("conversationId");
