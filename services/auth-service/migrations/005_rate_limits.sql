BEGIN;
-- Sign-in, sign-up and email-action attempt counts, shared by every auth-service replica (see rate-limiter.ts).
-- key is a SHA-256 digest of the bucket name, so no IP address or email address is stored. Rows expire with
-- their window and are swept regularly.
CREATE TABLE IF NOT EXISTS auth_rate_limits (
  key varchar(64) PRIMARY KEY,
  count integer NOT NULL,
  window_ends timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS auth_rate_limits_window_ends ON auth_rate_limits (window_ends);
COMMIT;
