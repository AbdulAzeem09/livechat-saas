-- The short-lived token handed out between the password step and the authenticator code.
ALTER TYPE "user_token_type" ADD VALUE IF NOT EXISTS 'TWO_FACTOR_CHALLENGE';
