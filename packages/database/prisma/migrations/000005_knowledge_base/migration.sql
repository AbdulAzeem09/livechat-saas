-- Knowledge base articles (self-service help + chatbot training source).
CREATE TABLE "knowledge_articles" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL,
  "title" VARCHAR(240) NOT NULL,
  "content" TEXT NOT NULL DEFAULT '',
  "category" VARCHAR(120) NOT NULL DEFAULT 'General',
  "published" BOOLEAN NOT NULL DEFAULT true,
  "views" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "knowledge_articles_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "knowledge_articles_organization_id_published_idx"
  ON "knowledge_articles"("organization_id", "published");
