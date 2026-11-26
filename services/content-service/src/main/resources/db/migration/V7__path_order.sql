-- Path order: Gen AI, AI/ML, Cloud, Backend, Full-stack Foundations, Forward Deployed.
-- Only rows still holding the original seeded values change, so Path editor edits are kept.
UPDATE learning_paths SET priority = 4 WHERE slug = 'backend' AND priority = 5;
UPDATE learning_paths SET priority = 5, name = 'Full-stack Foundations'
 WHERE slug = 'full-stack' AND priority = 4 AND name = 'Full Stack Engineering';