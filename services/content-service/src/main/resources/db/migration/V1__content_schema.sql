CREATE TABLE categories (
    id          BIGSERIAL PRIMARY KEY,
    slug        VARCHAR(100) NOT NULL UNIQUE,
    name        VARCHAR(200) NOT NULL,
    description TEXT,
    icon        VARCHAR(20),
    sort_order  INT NOT NULL DEFAULT 0
);

CREATE TABLE topics (
    id          BIGSERIAL PRIMARY KEY,
    category_id BIGINT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    slug        VARCHAR(100) NOT NULL UNIQUE,
    name        VARCHAR(200) NOT NULL,
    summary     TEXT,
    level       VARCHAR(20) NOT NULL DEFAULT 'BEGINNER',
    sort_order  INT NOT NULL DEFAULT 0
);

CREATE TABLE lessons (
    id          BIGSERIAL PRIMARY KEY,
    topic_id    BIGINT NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
    slug        VARCHAR(150) NOT NULL,
    title       VARCHAR(250) NOT NULL,
    step_number INT NOT NULL,
    content_md  TEXT NOT NULL,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (topic_id, slug)
);

CREATE INDEX idx_topics_category ON topics(category_id);
CREATE INDEX idx_lessons_topic ON lessons(topic_id, step_number);
