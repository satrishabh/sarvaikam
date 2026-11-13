CREATE TABLE reels (
    slug VARCHAR(150) PRIMARY KEY,
    course_slug VARCHAR(100) NOT NULL,
    lesson_slug VARCHAR(150) NOT NULL,
    heading VARCHAR(250) NOT NULL,
    content TEXT,
    content_object TEXT,
    source_name VARCHAR(250) NOT NULL,
    source_url VARCHAR(2000) NOT NULL,
    published BOOLEAN NOT NULL DEFAULT false,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (content IS NOT NULL OR content_object IS NOT NULL)
);
CREATE INDEX reels_feed ON reels(updated_at DESC, slug) WHERE published;
