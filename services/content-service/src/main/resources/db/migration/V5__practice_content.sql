CREATE TABLE content_documents (
    name VARCHAR(100) PRIMARY KEY,
    body TEXT,
    content_object TEXT,
    CHECK (body IS NOT NULL OR content_object IS NOT NULL)
);
