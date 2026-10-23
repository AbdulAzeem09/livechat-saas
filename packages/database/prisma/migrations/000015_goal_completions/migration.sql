-- Goal completions: one row the first time a visitor who chatted reaches a goal's target.
--
-- The unique index is the point of the table. Without it a thank-you page refreshed five
-- times would report five conversions, and the goal numbers would be worth nothing.
CREATE TABLE IF NOT EXISTS goal_completions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  goal_id         uuid NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  visitor_id      uuid NOT NULL REFERENCES visitors(id) ON DELETE CASCADE,
  conversation_id uuid REFERENCES conversations(id) ON DELETE SET NULL,
  value_cents     integer NOT NULL DEFAULT 0,
  completed_at    timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS goal_completions_goal_visitor_key
  ON goal_completions (goal_id, visitor_id);

CREATE INDEX IF NOT EXISTS goal_completions_organization_idx
  ON goal_completions (organization_id, completed_at);
