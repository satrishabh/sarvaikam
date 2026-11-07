BEGIN;
ALTER TABLE users ADD COLUMN IF NOT EXISTS business_status varchar NOT NULL DEFAULT 'NONE';
ALTER TABLE users ADD COLUMN IF NOT EXISTS organization varchar NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS business_website varchar NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS business_reason text NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS review_note text NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS reviewed_by uuid;
ALTER TABLE users ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;
ALTER TABLE users ADD COLUMN IF NOT EXISTS disabled boolean NOT NULL DEFAULT false;
CREATE TABLE IF NOT EXISTS role_policies (
  role varchar(10) PRIMARY KEY,
  permissions jsonb NOT NULL
);
CREATE TABLE IF NOT EXISTS access_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor uuid NOT NULL,
  action varchar NOT NULL,
  target varchar NOT NULL,
  details jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS users_business_status_idx ON users(business_status, created_at DESC);
CREATE INDEX IF NOT EXISTS access_audit_created_idx ON access_audit(created_at DESC);
COMMIT;
