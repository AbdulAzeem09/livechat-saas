CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;

CREATE TYPE organization_status AS ENUM ('TRIALING', 'ACTIVE', 'SUSPENDED', 'PAST_DUE', 'CANCELED');
CREATE TYPE user_status AS ENUM ('INVITED', 'ACTIVE', 'SUSPENDED', 'DELETED');
CREATE TYPE auth_provider AS ENUM ('PASSWORD', 'GOOGLE');
CREATE TYPE role_key AS ENUM ('OWNER', 'ADMIN', 'MANAGER', 'AGENT', 'VIEWER', 'BILLING');
CREATE TYPE agent_status AS ENUM ('OFFLINE', 'ONLINE', 'AWAY', 'BUSY');
CREATE TYPE conversation_status AS ENUM ('QUEUED', 'OPEN', 'PENDING', 'RESOLVED', 'CLOSED', 'SPAM');
CREATE TYPE conversation_priority AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');
CREATE TYPE conversation_source AS ENUM ('WIDGET', 'EMAIL', 'API', 'SOCIAL', 'MANUAL');
CREATE TYPE participant_type AS ENUM ('VISITOR', 'AGENT', 'SYSTEM');
CREATE TYPE message_type AS ENUM ('TEXT', 'FILE', 'SYSTEM', 'EVENT', 'NOTE');
CREATE TYPE message_visibility AS ENUM ('PUBLIC', 'INTERNAL');
CREATE TYPE message_status AS ENUM ('SENT', 'DELIVERED', 'READ', 'FAILED');
CREATE TYPE transfer_status AS ENUM ('REQUESTED', 'ACCEPTED', 'DECLINED', 'CANCELED', 'AUTO_EXPIRED');
CREATE TYPE ticket_status AS ENUM ('NEW', 'OPEN', 'PENDING', 'RESOLVED', 'CLOSED');
CREATE TYPE ticket_priority AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');
CREATE TYPE notification_channel AS ENUM ('EMAIL', 'IN_APP', 'WEBHOOK');
CREATE TYPE notification_status AS ENUM ('QUEUED', 'SENT', 'FAILED', 'SKIPPED');
CREATE TYPE subscription_status AS ENUM ('TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELED', 'UNPAID', 'INCOMPLETE');
CREATE TYPE billing_interval AS ENUM ('MONTHLY', 'YEARLY');

CREATE TABLE organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(160) NOT NULL,
  slug varchar(120) NOT NULL UNIQUE,
  status organization_status NOT NULL DEFAULT 'TRIALING',
  plan_code varchar(64) NOT NULL DEFAULT 'starter',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  trial_ends_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email citext NOT NULL UNIQUE,
  name varchar(160),
  avatar_url text,
  password_hash text,
  status user_status NOT NULL DEFAULT 'ACTIVE',
  email_verified_at timestamptz,
  last_login_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE TABLE auth_provider_identities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider auth_provider NOT NULL,
  provider_user_id varchar(191) NOT NULL,
  provider_email citext,
  access_token_hash text,
  refresh_token_hash text,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_user_id)
);

CREATE TABLE refresh_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  ip_address varchar(64),
  user_agent text,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE user_organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  display_name varchar(160),
  title varchar(120),
  timezone varchar(80) NOT NULL DEFAULT 'UTC',
  status user_status NOT NULL DEFAULT 'ACTIVE',
  agent_status agent_status NOT NULL DEFAULT 'OFFLINE',
  max_open_chats integer NOT NULL DEFAULT 5 CHECK (max_open_chats >= 0),
  last_seen_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, user_id)
);

CREATE TABLE roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  key role_key,
  name varchar(80) NOT NULL,
  description text,
  permissions jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_system boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, name),
  UNIQUE (organization_id, key)
);

CREATE TABLE user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  membership_id uuid NOT NULL REFERENCES user_organizations(id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (membership_id, role_id)
);

CREATE TABLE departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name varchar(120) NOT NULL,
  description text,
  routing_weight integer NOT NULL DEFAULT 100 CHECK (routing_weight >= 0),
  business_hours jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, name)
);

CREATE TABLE department_agents (
  department_id uuid NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  membership_id uuid NOT NULL REFERENCES user_organizations(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (department_id, membership_id)
);

CREATE TABLE invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email citext NOT NULL,
  role_id uuid REFERENCES roles(id) ON DELETE SET NULL,
  invited_by_id uuid REFERENCES user_organizations(id) ON DELETE SET NULL,
  token_hash text NOT NULL UNIQUE,
  status user_status NOT NULL DEFAULT 'INVITED',
  expires_at timestamptz NOT NULL,
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE chat_widgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name varchar(120) NOT NULL,
  public_key varchar(80) NOT NULL UNIQUE,
  secret_hash text NOT NULL,
  allowed_domains text[] NOT NULL DEFAULT ARRAY[]::text[],
  theme jsonb NOT NULL DEFAULT '{}'::jsonb,
  routing_rules jsonb NOT NULL DEFAULT '{}'::jsonb,
  welcome_message text,
  offline_message text,
  is_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email citext,
  name varchar(160),
  phone varchar(40),
  company varchar(160),
  external_id varchar(191),
  attributes jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  UNIQUE (organization_id, external_id)
);

CREATE TABLE tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name varchar(80) NOT NULL,
  color varchar(24),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, name)
);

CREATE TABLE contact_tags (
  contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (contact_id, tag_id)
);

CREATE TABLE contact_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  author_id uuid REFERENCES user_organizations(id) ON DELETE SET NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE visitors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES contacts(id) ON DELETE SET NULL,
  external_id varchar(191),
  name varchar(160),
  email citext,
  phone varchar(40),
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz,
  last_ip varchar(64),
  user_agent text,
  attributes jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, external_id)
);

CREATE TABLE visitor_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  visitor_id uuid NOT NULL REFERENCES visitors(id) ON DELETE CASCADE,
  widget_id uuid REFERENCES chat_widgets(id) ON DELETE SET NULL,
  session_token text NOT NULL UNIQUE,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  ip_address varchar(64),
  user_agent text,
  country varchar(80),
  region varchar(80),
  city varchar(120),
  referrer text,
  landing_page text,
  utm jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE visitor_page_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  visitor_id uuid NOT NULL REFERENCES visitors(id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES visitor_sessions(id) ON DELETE CASCADE,
  url text NOT NULL,
  title text,
  referrer text,
  duration_ms integer CHECK (duration_ms IS NULL OR duration_ms >= 0),
  viewed_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE visitor_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  visitor_id uuid NOT NULL REFERENCES visitors(id) ON DELETE CASCADE,
  session_id uuid REFERENCES visitor_sessions(id) ON DELETE SET NULL,
  name varchar(120) NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  visitor_id uuid REFERENCES visitors(id) ON DELETE SET NULL,
  contact_id uuid REFERENCES contacts(id) ON DELETE SET NULL,
  widget_id uuid REFERENCES chat_widgets(id) ON DELETE SET NULL,
  department_id uuid REFERENCES departments(id) ON DELETE SET NULL,
  assigned_agent_id uuid REFERENCES user_organizations(id) ON DELETE SET NULL,
  source conversation_source NOT NULL DEFAULT 'WIDGET',
  status conversation_status NOT NULL DEFAULT 'QUEUED',
  priority conversation_priority NOT NULL DEFAULT 'NORMAL',
  subject varchar(200),
  locale varchar(20),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  first_response_at timestamptz,
  last_message_at timestamptz,
  resolved_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE conversation_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  participant_type participant_type NOT NULL,
  visitor_id uuid REFERENCES visitors(id) ON DELETE CASCADE,
  membership_id uuid REFERENCES user_organizations(id) ON DELETE CASCADE,
  display_name varchar(160),
  joined_at timestamptz NOT NULL DEFAULT now(),
  left_at timestamptz,
  last_read_at timestamptz,
  CONSTRAINT conversation_participants_identity_check CHECK (
    (participant_type = 'VISITOR' AND visitor_id IS NOT NULL AND membership_id IS NULL)
    OR (participant_type = 'AGENT' AND membership_id IS NOT NULL AND visitor_id IS NULL)
    OR (participant_type = 'SYSTEM' AND visitor_id IS NULL AND membership_id IS NULL)
  )
);

CREATE TABLE messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_type participant_type NOT NULL,
  sender_visitor_id uuid REFERENCES visitors(id) ON DELETE SET NULL,
  sender_membership_id uuid REFERENCES user_organizations(id) ON DELETE SET NULL,
  type message_type NOT NULL DEFAULT 'TEXT',
  visibility message_visibility NOT NULL DEFAULT 'PUBLIC',
  status message_status NOT NULL DEFAULT 'SENT',
  body text,
  idempotency_key varchar(120),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  edited_at timestamptz,
  deleted_at timestamptz,
  CONSTRAINT messages_sender_identity_check CHECK (
    (sender_type = 'VISITOR' AND sender_visitor_id IS NOT NULL AND sender_membership_id IS NULL)
    OR (sender_type = 'AGENT' AND sender_membership_id IS NOT NULL AND sender_visitor_id IS NULL)
    OR (sender_type = 'SYSTEM' AND sender_visitor_id IS NULL AND sender_membership_id IS NULL)
  ),
  CONSTRAINT messages_body_or_event_check CHECK (
    body IS NOT NULL OR type IN ('FILE', 'SYSTEM', 'EVENT')
  ),
  UNIQUE (conversation_id, idempotency_key)
);

CREATE TABLE message_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  message_id uuid NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  uploaded_by_membership_id uuid REFERENCES user_organizations(id) ON DELETE SET NULL,
  uploaded_by_visitor_id uuid REFERENCES visitors(id) ON DELETE SET NULL,
  storage_key text NOT NULL,
  file_name text NOT NULL,
  mime_type varchar(160) NOT NULL,
  file_size bigint NOT NULL CHECK (file_size > 0),
  checksum varchar(128),
  public_url text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE message_delivery_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  participant_id uuid NOT NULL REFERENCES conversation_participants(id) ON DELETE CASCADE,
  delivered_at timestamptz,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (message_id, participant_id)
);

CREATE TABLE conversation_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  agent_id uuid NOT NULL REFERENCES user_organizations(id) ON DELETE CASCADE,
  assigned_by_id uuid REFERENCES user_organizations(id) ON DELETE SET NULL,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  unassigned_at timestamptz,
  reason text
);

CREATE TABLE chat_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  from_agent_id uuid REFERENCES user_organizations(id) ON DELETE SET NULL,
  to_agent_id uuid REFERENCES user_organizations(id) ON DELETE SET NULL,
  to_department_id uuid REFERENCES departments(id) ON DELETE SET NULL,
  requested_by_id uuid REFERENCES user_organizations(id) ON DELETE SET NULL,
  status transfer_status NOT NULL DEFAULT 'REQUESTED',
  reason text,
  response_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz,
  CONSTRAINT chat_transfers_target_check CHECK (to_agent_id IS NOT NULL OR to_department_id IS NOT NULL)
);

CREATE TABLE canned_response_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name varchar(120) NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, name)
);

CREATE TABLE canned_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  category_id uuid REFERENCES canned_response_categories(id) ON DELETE SET NULL,
  department_id uuid REFERENCES departments(id) ON DELETE SET NULL,
  created_by_id uuid REFERENCES user_organizations(id) ON DELETE SET NULL,
  title varchar(160) NOT NULL,
  shortcut varchar(80) NOT NULL,
  body text NOT NULL,
  tags text[] NOT NULL DEFAULT ARRAY[]::text[],
  is_shared boolean NOT NULL DEFAULT true,
  usage_count integer NOT NULL DEFAULT 0 CHECK (usage_count >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, shortcut)
);

CREATE TABLE tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES contacts(id) ON DELETE SET NULL,
  visitor_id uuid REFERENCES visitors(id) ON DELETE SET NULL,
  conversation_id uuid REFERENCES conversations(id) ON DELETE SET NULL,
  assignee_id uuid REFERENCES user_organizations(id) ON DELETE SET NULL,
  created_by_id uuid REFERENCES user_organizations(id) ON DELETE SET NULL,
  status ticket_status NOT NULL DEFAULT 'NEW',
  priority ticket_priority NOT NULL DEFAULT 'NORMAL',
  subject varchar(220) NOT NULL,
  description text,
  due_at timestamptz,
  resolved_at timestamptz,
  closed_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE ticket_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  ticket_id uuid NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  author_id uuid REFERENCES user_organizations(id) ON DELETE SET NULL,
  body text NOT NULL,
  is_internal boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE ticket_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  ticket_id uuid NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES user_organizations(id) ON DELETE SET NULL,
  event_type varchar(120) NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  key varchar(120) NOT NULL,
  subject text NOT NULL,
  html_body text NOT NULL,
  text_body text,
  is_system boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  recipient_membership_id uuid REFERENCES user_organizations(id) ON DELETE SET NULL,
  recipient_email citext,
  channel notification_channel NOT NULL,
  status notification_status NOT NULL DEFAULT 'QUEUED',
  type varchar(120) NOT NULL,
  subject text,
  body text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  scheduled_at timestamptz,
  sent_at timestamptz,
  failed_at timestamptz,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE billing_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code varchar(64) NOT NULL UNIQUE,
  name varchar(120) NOT NULL,
  interval billing_interval NOT NULL,
  price_cents integer NOT NULL CHECK (price_cents >= 0),
  currency varchar(3) NOT NULL DEFAULT 'usd',
  stripe_price_id varchar(191) UNIQUE,
  features jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE billing_customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,
  stripe_customer_id varchar(191) NOT NULL UNIQUE,
  billing_email citext,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE billing_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  billing_customer_id uuid NOT NULL REFERENCES billing_customers(id) ON DELETE CASCADE,
  plan_id uuid REFERENCES billing_plans(id) ON DELETE SET NULL,
  stripe_subscription_id varchar(191) NOT NULL UNIQUE,
  status subscription_status NOT NULL,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  canceled_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE billing_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  subscription_id uuid REFERENCES billing_subscriptions(id) ON DELETE SET NULL,
  stripe_invoice_id varchar(191) NOT NULL UNIQUE,
  status varchar(60) NOT NULL,
  currency varchar(3) NOT NULL DEFAULT 'usd',
  amount_due_cents integer NOT NULL CHECK (amount_due_cents >= 0),
  amount_paid_cents integer NOT NULL DEFAULT 0 CHECK (amount_paid_cents >= 0),
  hosted_invoice_url text,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE analytics_daily_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  department_id uuid REFERENCES departments(id) ON DELETE CASCADE,
  agent_id uuid REFERENCES user_organizations(id) ON DELETE CASCADE,
  date date NOT NULL,
  conversations_started integer NOT NULL DEFAULT 0 CHECK (conversations_started >= 0),
  conversations_resolved integer NOT NULL DEFAULT 0 CHECK (conversations_resolved >= 0),
  messages_sent integer NOT NULL DEFAULT 0 CHECK (messages_sent >= 0),
  missed_chats integer NOT NULL DEFAULT 0 CHECK (missed_chats >= 0),
  average_first_response_sec integer CHECK (average_first_response_sec IS NULL OR average_first_response_sec >= 0),
  average_resolution_sec integer CHECK (average_resolution_sec IS NULL OR average_resolution_sec >= 0),
  satisfaction_score numeric(5, 2) CHECK (satisfaction_score IS NULL OR (satisfaction_score >= 0 AND satisfaction_score <= 100)),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name varchar(120) NOT NULL,
  key_prefix varchar(16) NOT NULL,
  key_hash text NOT NULL UNIQUE,
  scopes text[] NOT NULL DEFAULT ARRAY[]::text[],
  last_used_at timestamptz,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_by_id uuid REFERENCES user_organizations(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE webhook_endpoints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  url text NOT NULL,
  secret_hash text NOT NULL,
  events text[] NOT NULL DEFAULT ARRAY[]::text[],
  is_active boolean NOT NULL DEFAULT true,
  last_success_at timestamptz,
  last_failure_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  actor_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  actor_member_id uuid REFERENCES user_organizations(id) ON DELETE SET NULL,
  action varchar(160) NOT NULL,
  entity_type varchar(120),
  entity_id uuid,
  ip_address varchar(64),
  user_agent text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX organizations_status_idx ON organizations (status);
CREATE INDEX users_status_idx ON users (status);
CREATE INDEX auth_provider_identities_user_id_idx ON auth_provider_identities (user_id);
CREATE INDEX refresh_tokens_user_id_idx ON refresh_tokens (user_id);
CREATE INDEX refresh_tokens_expires_at_idx ON refresh_tokens (expires_at);
CREATE INDEX user_organizations_org_status_idx ON user_organizations (organization_id, status);
CREATE INDEX user_organizations_org_agent_status_idx ON user_organizations (organization_id, agent_status);
CREATE INDEX user_roles_organization_id_idx ON user_roles (organization_id);
CREATE INDEX departments_org_default_idx ON departments (organization_id, is_default);
CREATE UNIQUE INDEX departments_one_default_idx ON departments (organization_id) WHERE is_default = true;
CREATE INDEX department_agents_membership_id_idx ON department_agents (membership_id);
CREATE INDEX invitations_org_email_idx ON invitations (organization_id, email);
CREATE UNIQUE INDEX invitations_open_email_idx ON invitations (organization_id, email) WHERE accepted_at IS NULL AND revoked_at IS NULL;
CREATE INDEX chat_widgets_org_enabled_idx ON chat_widgets (organization_id, is_enabled);
CREATE INDEX contacts_org_email_idx ON contacts (organization_id, email);
CREATE UNIQUE INDEX contacts_org_email_active_idx ON contacts (organization_id, email) WHERE email IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX contacts_org_company_idx ON contacts (organization_id, company);
CREATE INDEX contact_tags_tag_id_idx ON contact_tags (tag_id);
CREATE INDEX contact_notes_org_contact_idx ON contact_notes (organization_id, contact_id);
CREATE INDEX visitors_org_email_idx ON visitors (organization_id, email);
CREATE INDEX visitors_org_last_seen_idx ON visitors (organization_id, last_seen_at);
CREATE INDEX visitor_sessions_org_visitor_idx ON visitor_sessions (organization_id, visitor_id);
CREATE INDEX visitor_sessions_org_started_idx ON visitor_sessions (organization_id, started_at);
CREATE INDEX visitor_page_views_org_visitor_viewed_idx ON visitor_page_views (organization_id, visitor_id, viewed_at);
CREATE INDEX visitor_page_views_session_id_idx ON visitor_page_views (session_id);
CREATE INDEX visitor_events_org_visitor_occurred_idx ON visitor_events (organization_id, visitor_id, occurred_at);
CREATE INDEX visitor_events_org_name_idx ON visitor_events (organization_id, name);
CREATE INDEX conversations_org_status_priority_idx ON conversations (organization_id, status, priority);
CREATE INDEX conversations_org_assigned_status_idx ON conversations (organization_id, assigned_agent_id, status);
CREATE INDEX conversations_org_last_message_idx ON conversations (organization_id, last_message_at);
CREATE INDEX conversations_visitor_id_idx ON conversations (visitor_id);
CREATE INDEX conversations_contact_id_idx ON conversations (contact_id);
CREATE INDEX conversation_participants_conversation_id_idx ON conversation_participants (conversation_id);
CREATE INDEX conversation_participants_org_membership_idx ON conversation_participants (organization_id, membership_id);
CREATE INDEX conversation_participants_org_visitor_idx ON conversation_participants (organization_id, visitor_id);
CREATE UNIQUE INDEX conversation_participants_active_visitor_idx ON conversation_participants (conversation_id, visitor_id) WHERE visitor_id IS NOT NULL AND left_at IS NULL;
CREATE UNIQUE INDEX conversation_participants_active_agent_idx ON conversation_participants (conversation_id, membership_id) WHERE membership_id IS NOT NULL AND left_at IS NULL;
CREATE INDEX messages_org_conversation_created_idx ON messages (organization_id, conversation_id, created_at);
CREATE INDEX messages_org_sender_membership_idx ON messages (organization_id, sender_membership_id);
CREATE INDEX message_attachments_org_message_idx ON message_attachments (organization_id, message_id);
CREATE INDEX conversation_assignments_org_agent_open_idx ON conversation_assignments (organization_id, agent_id, unassigned_at);
CREATE INDEX conversation_assignments_conversation_id_idx ON conversation_assignments (conversation_id);
CREATE UNIQUE INDEX conversation_assignments_one_open_idx ON conversation_assignments (conversation_id, agent_id) WHERE unassigned_at IS NULL;
CREATE INDEX chat_transfers_org_status_idx ON chat_transfers (organization_id, status);
CREATE INDEX chat_transfers_conversation_id_idx ON chat_transfers (conversation_id);
CREATE INDEX canned_responses_org_department_idx ON canned_responses (organization_id, department_id);
CREATE INDEX tickets_org_status_priority_idx ON tickets (organization_id, status, priority);
CREATE INDEX tickets_org_assignee_idx ON tickets (organization_id, assignee_id);
CREATE INDEX tickets_contact_id_idx ON tickets (contact_id);
CREATE INDEX ticket_comments_org_ticket_idx ON ticket_comments (organization_id, ticket_id);
CREATE INDEX ticket_events_org_ticket_created_idx ON ticket_events (organization_id, ticket_id, created_at);
CREATE UNIQUE INDEX email_templates_system_key_idx ON email_templates (key) WHERE organization_id IS NULL;
CREATE UNIQUE INDEX email_templates_org_key_idx ON email_templates (organization_id, key) WHERE organization_id IS NOT NULL;
CREATE INDEX notifications_org_status_channel_idx ON notifications (organization_id, status, channel);
CREATE INDEX notifications_recipient_membership_idx ON notifications (recipient_membership_id);
CREATE INDEX billing_subscriptions_org_status_idx ON billing_subscriptions (organization_id, status);
CREATE UNIQUE INDEX billing_subscriptions_one_current_idx ON billing_subscriptions (organization_id) WHERE status IN ('TRIALING', 'ACTIVE', 'PAST_DUE', 'INCOMPLETE');
CREATE INDEX billing_invoices_org_created_idx ON billing_invoices (organization_id, created_at);
CREATE INDEX analytics_daily_metrics_org_date_idx ON analytics_daily_metrics (organization_id, date);
CREATE INDEX analytics_daily_metrics_org_department_date_idx ON analytics_daily_metrics (organization_id, department_id, date);
CREATE INDEX analytics_daily_metrics_org_agent_date_idx ON analytics_daily_metrics (organization_id, agent_id, date);
CREATE UNIQUE INDEX analytics_daily_metrics_scope_idx ON analytics_daily_metrics (
  organization_id,
  date,
  (COALESCE(department_id, '00000000-0000-0000-0000-000000000000'::uuid)),
  (COALESCE(agent_id, '00000000-0000-0000-0000-000000000000'::uuid))
);
CREATE INDEX api_keys_organization_id_idx ON api_keys (organization_id);
CREATE INDEX webhook_endpoints_org_active_idx ON webhook_endpoints (organization_id, is_active);
CREATE INDEX audit_logs_org_created_idx ON audit_logs (organization_id, created_at);
CREATE INDEX audit_logs_actor_user_idx ON audit_logs (actor_user_id);

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'organizations',
    'users',
    'auth_provider_identities',
    'user_organizations',
    'roles',
    'departments',
    'chat_widgets',
    'contacts',
    'contact_notes',
    'visitors',
    'conversations',
    'canned_response_categories',
    'canned_responses',
    'tickets',
    'ticket_comments',
    'email_templates',
    'billing_plans',
    'billing_customers',
    'billing_subscriptions',
    'analytics_daily_metrics',
    'webhook_endpoints'
  ]
  LOOP
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION set_updated_at()',
      table_name || '_set_updated_at',
      table_name
    );
  END LOOP;
END $$;
