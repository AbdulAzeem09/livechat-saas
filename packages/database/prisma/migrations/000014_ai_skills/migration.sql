-- Skills: plain-language rules that tell the AI what to do in a particular situation.
CREATE TABLE IF NOT EXISTS ai_skills (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name            varchar(120) NOT NULL,
  instruction     text NOT NULL,
  keywords        text[] NOT NULL DEFAULT '{}',
  is_active       boolean NOT NULL DEFAULT true,
  position        smallint NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_skills_organization_idx ON ai_skills (organization_id, is_active);
