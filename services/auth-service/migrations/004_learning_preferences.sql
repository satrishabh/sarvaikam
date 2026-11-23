BEGIN;
-- The path and daily goal chosen during first-run onboarding (see LearningPreferencesDto).
ALTER TABLE users ADD COLUMN IF NOT EXISTS learning_preferences jsonb NOT NULL DEFAULT '{}'::jsonb;
COMMIT;
