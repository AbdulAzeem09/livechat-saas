-- Automation rules: chatbot greetings + keyword auto-replies.
CREATE TABLE "automation_rules" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL,
  "name" VARCHAR(120) NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "is_greeting" BOOLEAN NOT NULL DEFAULT false,
  "keywords" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "reply_message" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "automation_rules_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "automation_rules_organization_id_enabled_idx"
  ON "automation_rules"("organization_id", "enabled");
