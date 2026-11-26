-- Which bundled seed version a lesson still matches (see SeedLoader). A SHA-256 of the seed's title and body:
-- the lesson is untouched since that seed, so a newer seed may replace it. 'edited': an editor saved it in the
-- Content studio, so seeds never overwrite it. NULL: seeded before V10; checked once on the next start.
ALTER TABLE lessons ADD COLUMN seed_sha256 VARCHAR(64);
