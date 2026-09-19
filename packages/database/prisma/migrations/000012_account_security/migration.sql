-- Account security: two-factor sign-in and lockout after repeated failed passwords.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS two_factor_secret         text,
  ADD COLUMN IF NOT EXISTS two_factor_enabled_at     timestamptz,
  ADD COLUMN IF NOT EXISTS two_factor_recovery_codes text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS failed_login_attempts     smallint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS locked_until              timestamptz,
  ADD COLUMN IF NOT EXISTS password_changed_at       timestamptz;
