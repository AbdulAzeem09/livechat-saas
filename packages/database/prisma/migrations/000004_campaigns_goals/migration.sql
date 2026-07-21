-- Campaigns: proactive chat invites shown to visitors.
CREATE TABLE "campaigns" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL,
  "name" VARCHAR(160) NOT NULL,
  "type" VARCHAR(20) NOT NULL DEFAULT 'recurring',
  "trigger_type" VARCHAR(40) NOT NULL DEFAULT 'page_visit',
  "trigger_value" VARCHAR(500) NOT NULL DEFAULT '',
  "message" TEXT NOT NULL DEFAULT '',
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "displayed_count" INTEGER NOT NULL DEFAULT 0,
  "chats_count" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "campaigns_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "campaigns_organization_id_enabled_idx"
  ON "campaigns"("organization_id", "enabled");

-- Goals: measurable outcomes (lead captured, sale, resolved case).
CREATE TABLE "goals" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL,
  "name" VARCHAR(160) NOT NULL,
  "type" VARCHAR(20) NOT NULL DEFAULT 'url',
  "target" VARCHAR(500) NOT NULL DEFAULT '',
  "value_cents" INTEGER NOT NULL DEFAULT 0,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "completed_count" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "goals_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "goals_organization_id_enabled_idx"
  ON "goals"("organization_id", "enabled");
