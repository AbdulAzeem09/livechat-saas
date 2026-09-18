-- Scheduled report emails: a CSV of the numbers, sent to people who never open the dashboard.
CREATE TABLE IF NOT EXISTS report_schedules (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  report_type     varchar(40) NOT NULL,
  frequency       varchar(20) NOT NULL DEFAULT 'weekly',
  recipients      text[] NOT NULL DEFAULT '{}',
  hour_utc        smallint NOT NULL DEFAULT 7,
  is_active       boolean NOT NULL DEFAULT true,
  last_run_at     timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS report_schedules_org_idx ON report_schedules (organization_id, is_active);
