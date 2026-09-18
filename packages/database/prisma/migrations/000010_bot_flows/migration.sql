-- Visual chatbot: a flow is a set of connected steps (ask, answer, branch, hand over).
CREATE TABLE IF NOT EXISTS bot_flows (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name            varchar(120) NOT NULL,
  is_active       boolean NOT NULL DEFAULT false,
  start_node_id   varchar(64),
  nodes           jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS bot_flows_organization_idx ON bot_flows (organization_id, is_active);
