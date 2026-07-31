ALTER TABLE "WhatsAppConversation"
ADD COLUMN IF NOT EXISTS "currentState" TEXT DEFAULT 'welcome';

UPDATE "WhatsAppConversation"
SET "currentState" = 'welcome'
WHERE "currentState" IS NULL;
