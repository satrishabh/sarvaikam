# Learning levels

Every topic uses the same progression. The level describes depth within that topic; topic prerequisites still matter.

| Level | Purpose | Ready for the next level when… |
|---|---|---|
| Starter | Vocabulary, fundamentals, and first examples | You can explain the basics and complete a small task independently. |
| Intermediate | Practical application and connected concepts | You can build a working example, test edge cases, and explain your choices. |
| Advanced | Production behavior, failure modes, performance, and trade-offs | You can investigate a realistic problem and justify an approach with evidence. |
| Deep Dive | Optional specialist internals and unusual cases | Continue according to your interests and work; this level is not required for the core path. |

The catalogue contains 194 classified lessons across 33 topics: 68 Starter, 67 Intermediate, 50 Advanced, and 9 Deep Dive. Java has 25 lessons: 4 Starter, 9 Intermediate, 9 Advanced, and 3 Deep Dive. Empty levels are explicitly marked as awaiting material; a level section does not imply that its content has already been written.

Topic pages group lessons into collapsible sections with per-level counts and saved completion. The reader shows a level badge. Topic ordering and previous/next navigation use the same level order, followed by the existing step number. Lesson IDs and URL slugs remain stable, preserving saved progress. Completing the core levels is acknowledged independently of optional Deep Dive completion.

## Adding material

In Content studio, select the topic and set **Learning level** when adding or editing a lesson. Choose an appropriate step within that level. The exclusive-access setting is independent of difficulty. Attach large files using the configured private bucket; the lesson body should contain the explanation, worked example, practice task, and self-review criteria.

Seed lessons accept `stage`: `STARTER`, `INTERMEDIATE`, `ADVANCED`, or `DEEP_DIVE`. Flyway migration V3 classifies existing known seed lessons once. New CMS-only lessons default to Starter. Existing clients that omit `stage` preserve the saved level when editing. Seed loading continues to insert only missing lessons, preserving CMS edits.

New materials should be split into focused lessons and assigned by conceptual depth, prerequisites, independence required, and practical outcomes. Do not classify by file size or manufacture rarity claims. Keep Deep Dive optional and explain why someone might choose to study it.

## Validation

Frontend type checking, production build, eight learning tests, and twelve backend tests passed. Coverage includes level ordering, backward-compatible edits, reader navigation, valid seed stages, and unique lesson URLs. The Java topic was checked in a browser at mobile and desktop sizes using mocked API content; mobile had no horizontal overflow or runtime errors.
