-- Move to LiveChat-style pricing: Starter flat (1 agent), Team/Business per-agent (per-seat).
-- price_cents for per-seat plans is the PER-AGENT monthly price.

UPDATE "billing_plans"
SET "price_cents" = 1900,
    "features" = '{"agents":1,"perSeat":false,"channels":["website"]}'::jsonb,
    "updated_at" = now()
WHERE "code" = 'starter';

UPDATE "billing_plans"
SET "price_cents" = 5900,
    "features" = '{"perSeat":true,"channels":["website","email"]}'::jsonb,
    "updated_at" = now()
WHERE "code" = 'team';

UPDATE "billing_plans"
SET "price_cents" = 8900,
    "features" = '{"perSeat":true,"channels":["website","email","social"]}'::jsonb,
    "updated_at" = now()
WHERE "code" = 'business';
