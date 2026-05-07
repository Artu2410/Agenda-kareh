ALTER TABLE "WhatsAppConversation"
ADD COLUMN IF NOT EXISTS "lastAutoReplyAt" TIMESTAMP(3);
