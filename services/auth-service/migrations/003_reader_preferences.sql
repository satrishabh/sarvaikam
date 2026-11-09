BEGIN;
ALTER TABLE users ADD COLUMN IF NOT EXISTS reader_preferences jsonb NOT NULL DEFAULT '{}'::jsonb;
COMMIT;
