CREATE TABLE learning_paths (
    slug VARCHAR(100) PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    subtitle TEXT NOT NULL,
    description TEXT NOT NULL,
    icon VARCHAR(30) NOT NULL,
    tone VARCHAR(30) NOT NULL,
    priority INT NOT NULL CHECK (priority > 0)
);
CREATE TABLE learning_path_topics (
    path_slug VARCHAR(100) NOT NULL REFERENCES learning_paths(slug) ON DELETE CASCADE,
    topic_slug VARCHAR(100) NOT NULL REFERENCES topics(slug) ON DELETE CASCADE,
    position INT NOT NULL CHECK (position > 0),
    PRIMARY KEY(path_slug, topic_slug),
    UNIQUE(path_slug, position)
);
CREATE TABLE learning_path_outcomes (
    path_slug VARCHAR(100) NOT NULL REFERENCES learning_paths(slug) ON DELETE CASCADE,
    position INT NOT NULL CHECK (position > 0),
    outcome TEXT NOT NULL,
    PRIMARY KEY(path_slug, position)
);
