-- Password reset + email verification, agent schedules, messaging channels, SSO, app installs,
-- notification read state, and message channel identifiers.

-- ---------- one-time account tokens (password reset / email verification) ----------
CREATE TYPE "user_token_type" AS ENUM ('PASSWORD_RESET', 'EMAIL_VERIFICATION');

CREATE TABLE "user_tokens" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL,
  "type" "user_token_type" NOT NULL,
  "token_hash" varchar(128) NOT NULL,
  "expires_at" timestamptz(6) NOT NULL,
  "used_at" timestamptz(6),
  "created_at" timestamptz(6) NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX "user_tokens_token_hash_key" ON "user_tokens" ("token_hash");
CREATE INDEX "user_tokens_user_id_type_idx" ON "user_tokens" ("user_id", "type");

-- ---------- agent work schedule (weekly shifts, used by routing) ----------
CREATE TABLE "agent_schedules" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" uuid NOT NULL,
  "membership_id" uuid NOT NULL,
  "day_of_week" smallint NOT NULL,
  "start_minute" smallint NOT NULL,
  "end_minute" smallint NOT NULL,
  "created_at" timestamptz(6) NOT NULL DEFAULT now(),
  CONSTRAINT "agent_schedules_day_of_week_check" CHECK ("day_of_week" BETWEEN 0 AND 6),
  CONSTRAINT "agent_schedules_minutes_check" CHECK ("start_minute" >= 0 AND "end_minute" <= 1440 AND "start_minute" < "end_minute")
);

CREATE UNIQUE INDEX "agent_schedules_membership_day_start_key"
  ON "agent_schedules" ("membership_id", "day_of_week", "start_minute");
CREATE INDEX "agent_schedules_organization_id_idx" ON "agent_schedules" ("organization_id");

-- ---------- messaging channels (WhatsApp / Messenger / Instagram / Apple) ----------
CREATE TYPE "messaging_channel" AS ENUM ('WHATSAPP', 'MESSENGER', 'INSTAGRAM', 'APPLE');

CREATE TABLE "channel_connections" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" uuid NOT NULL,
  "channel" "messaging_channel" NOT NULL,
  "external_id" varchar(191) NOT NULL,
  "display_name" varchar(160),
  "access_token" text,
  "app_secret" text,
  "verify_token" varchar(191),
  "settings" jsonb NOT NULL DEFAULT '{}',
  "is_active" boolean NOT NULL DEFAULT true,
  "last_event_at" timestamptz(6),
  "created_at" timestamptz(6) NOT NULL DEFAULT now(),
  "updated_at" timestamptz(6) NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX "channel_connections_org_channel_key" ON "channel_connections" ("organization_id", "channel");
CREATE UNIQUE INDEX "channel_connections_channel_external_id_key" ON "channel_connections" ("channel", "external_id");

-- Conversations and messages can now come from a messaging channel
ALTER TABLE "conversations" ADD COLUMN "channel" "messaging_channel";
ALTER TABLE "conversations" ADD COLUMN "channel_thread_id" varchar(191);
CREATE UNIQUE INDEX "conversations_channel_thread_key"
  ON "conversations" ("organization_id", "channel", "channel_thread_id")
  WHERE "channel_thread_id" IS NOT NULL;

ALTER TABLE "messages" ADD COLUMN "channel_message_id" varchar(191);
CREATE UNIQUE INDEX "messages_channel_message_id_key"
  ON "messages" ("organization_id", "channel_message_id")
  WHERE "channel_message_id" IS NOT NULL;

-- ---------- SSO (OIDC: Google Workspace, Microsoft Entra, generic) ----------
CREATE TYPE "sso_provider" AS ENUM ('GOOGLE', 'MICROSOFT', 'OIDC');

CREATE TABLE "sso_connections" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" uuid NOT NULL,
  "provider" "sso_provider" NOT NULL,
  "email_domain" varchar(191) NOT NULL,
  "issuer" varchar(400),
  "client_id" varchar(400) NOT NULL,
  "client_secret" text NOT NULL,
  "default_role_id" uuid,
  "auto_provision" boolean NOT NULL DEFAULT true,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamptz(6) NOT NULL DEFAULT now(),
  "updated_at" timestamptz(6) NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX "sso_connections_organization_id_key" ON "sso_connections" ("organization_id");
CREATE UNIQUE INDEX "sso_connections_email_domain_key" ON "sso_connections" ("email_domain");

-- ---------- apps marketplace installs ----------
CREATE TABLE "app_installs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" uuid NOT NULL,
  "app_key" varchar(80) NOT NULL,
  "settings" jsonb NOT NULL DEFAULT '{}',
  "installed_by_membership_id" uuid,
  "installed_at" timestamptz(6) NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX "app_installs_org_app_key" ON "app_installs" ("organization_id", "app_key");

-- ---------- in-app notification bell ----------
ALTER TABLE "notifications" ADD COLUMN "read_at" timestamptz(6);
CREATE INDEX "notifications_org_recipient_read_idx"
  ON "notifications" ("organization_id", "recipient_membership_id", "read_at");
