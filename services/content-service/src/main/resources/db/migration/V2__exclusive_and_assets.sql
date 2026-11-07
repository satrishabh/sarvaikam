ALTER TABLE lessons ADD COLUMN exclusive boolean NOT NULL DEFAULT false;
CREATE TABLE lesson_assets (
  id uuid PRIMARY KEY,
  lesson_id bigint NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  object_name varchar(500) NOT NULL UNIQUE,
  filename varchar(200) NOT NULL,
  content_type varchar(100) NOT NULL,
  expected_size bigint NOT NULL CHECK (expected_size > 0),
  generation bigint,
  ready boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX lesson_assets_lesson_idx ON lesson_assets(lesson_id);
