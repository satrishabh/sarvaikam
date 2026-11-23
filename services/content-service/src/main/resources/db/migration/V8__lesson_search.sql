-- Full-text search over lessons. Bodies may live in the bucket (content_md NULL), so the app keeps a
-- plain-text copy in search_text; the vector weights titles above body text.
ALTER TABLE lessons ADD COLUMN search_text TEXT;
ALTER TABLE lessons ADD COLUMN search_vector tsvector GENERATED ALWAYS AS (
    setweight(to_tsvector('english'::regconfig, coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english'::regconfig, coalesce(search_text, '')), 'B')
) STORED;
CREATE INDEX lessons_search_idx ON lessons USING GIN (search_vector);
