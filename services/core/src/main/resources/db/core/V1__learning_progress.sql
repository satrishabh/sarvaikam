-- The tables progress-service created. IF NOT EXISTS because both services share them until the gateway sends
-- all /api/progress traffic to the Core; they move into a "learning" schema once progress-service is retired.
CREATE TABLE IF NOT EXISTS lesson_progress (
    user_id      UUID         NOT NULL,
    lesson_id    BIGINT       NOT NULL,
    topic_slug   VARCHAR(100) NOT NULL,
    completed_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, lesson_id)
);
CREATE INDEX IF NOT EXISTS idx_progress_user_topic ON lesson_progress(user_id, topic_slug);

CREATE TABLE IF NOT EXISTS lesson_bookmarks (
    user_id    UUID         NOT NULL,
    lesson_id  BIGINT       NOT NULL,
    topic_slug VARCHAR(100) NOT NULL,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, lesson_id)
);
CREATE INDEX IF NOT EXISTS idx_bookmarks_user_created ON lesson_bookmarks(user_id, created_at DESC);
