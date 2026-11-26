-- Slugs of reels ever created from reels-seed.json. A seed is inserted at most once, so a draft an editor
-- deletes or rewrites is never recreated on the next start.
CREATE TABLE reel_seeds (
    slug VARCHAR(150) PRIMARY KEY,
    seeded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
