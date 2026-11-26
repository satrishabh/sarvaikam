-- SHA-256 of the bundled practice-questions.json the stored copy was made from. On startup a different hash
-- means the file changed, and the stored copy is replaced (nothing in the app edits this document).
ALTER TABLE content_documents ADD COLUMN seed_sha256 VARCHAR(64);
