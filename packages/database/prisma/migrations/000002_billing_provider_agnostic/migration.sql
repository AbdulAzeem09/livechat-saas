-- Make billing provider-agnostic (support Authorize.net, not only Stripe).

-- Relax the Stripe NOT NULL constraints so non-Stripe / mock subscriptions are valid.
ALTER TABLE "billing_customers" ALTER COLUMN "stripe_customer_id" DROP NOT NULL;
ALTER TABLE "billing_subscriptions" ALTER COLUMN "stripe_subscription_id" DROP NOT NULL;
ALTER TABLE "billing_invoices" ALTER COLUMN "stripe_invoice_id" DROP NOT NULL;

-- Provider-agnostic columns.
ALTER TABLE "billing_customers" ADD COLUMN "provider" VARCHAR(40) NOT NULL DEFAULT 'authorizenet';
ALTER TABLE "billing_customers" ADD COLUMN "provider_customer_id" VARCHAR(191);

ALTER TABLE "billing_subscriptions" ADD COLUMN "provider" VARCHAR(40) NOT NULL DEFAULT 'authorizenet';
ALTER TABLE "billing_subscriptions" ADD COLUMN "provider_subscription_id" VARCHAR(191);

ALTER TABLE "billing_invoices" ADD COLUMN "provider_invoice_id" VARCHAR(191);

-- Unique indexes for the new provider ids.
CREATE UNIQUE INDEX "billing_customers_provider_customer_id_key" ON "billing_customers"("provider_customer_id");
CREATE UNIQUE INDEX "billing_subscriptions_provider_subscription_id_key" ON "billing_subscriptions"("provider_subscription_id");
CREATE UNIQUE INDEX "billing_invoices_provider_invoice_id_key" ON "billing_invoices"("provider_invoice_id");

-- Seed default plans (idempotent).
INSERT INTO "billing_plans" ("name", "code", "interval", "price_cents", "currency", "features", "is_active", "updated_at")
VALUES
  ('Starter',  'starter',  'MONTHLY'::"billing_interval", 1900, 'usd', '{"agents":1,"channels":["website"]}'::jsonb,            true, now()),
  ('Team',     'team',     'MONTHLY'::"billing_interval", 3900, 'usd', '{"agents":5,"channels":["website","email"]}'::jsonb,    true, now()),
  ('Business', 'business', 'MONTHLY'::"billing_interval", 5900, 'usd', '{"agents":10,"channels":["website","email","social"]}'::jsonb, true, now())
ON CONFLICT ("code") DO NOTHING;
