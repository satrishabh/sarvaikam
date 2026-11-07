-- Safe baseline for a fresh auth database; leaves existing user records untouched.
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email varchar NOT NULL UNIQUE,
  name varchar NOT NULL,
  password_hash varchar NOT NULL,
  role varchar(10) NOT NULL DEFAULT 'USER',
  created_at timestamptz NOT NULL DEFAULT now()
);
