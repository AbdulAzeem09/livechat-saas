-- Ecommerce sales tracking
CREATE TABLE "sales" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "conversation_id" UUID,
    "visitor_id" UUID,
    "amount_cents" INTEGER NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'usd',
    "reference" VARCHAR(191),
    "source" VARCHAR(40) NOT NULL DEFAULT 'widget',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),

    CONSTRAINT "sales_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "sales_organization_id_created_at_idx" ON "sales" ("organization_id", "created_at");
