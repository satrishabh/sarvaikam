ALTER TABLE lessons ADD COLUMN content_object TEXT;
ALTER TABLE lessons ALTER COLUMN content_md DROP NOT NULL;
