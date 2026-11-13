# Progress and to-do

Last updated: 2026-11-13

## In progress

- **Bucket content, learning paths and reels backend** (branch `feat/bucket-content-paths-reels`, open a PR to `main`)
  - Done: lesson and practice bodies move to the private `GCP_CONTENT_BUCKET` (metadata stays in PostgreSQL); reels move to a separate `sarvaikam_reels` database; admin editors for courses, lesson steps, learning paths and reels; Flyway V4 to V6. See `docs/backend-content.md` and `docs/admin-content-studio.md`.
  - Done: mock reels removed; reels and practice questions come from the backend.
  - Verified locally on 13 Nov: 23 backend tests, 27 frontend tests and the production build pass. Not deployed.
- **Dev database moved to Cloud SQL (resolved 2026-11-13):** dev now uses databases `sarvaikam` and `sarvaikam_reels` on Cloud SQL `aio-002` (user `sarvaikam_app`, password in K8s secret `dev/sarvaikam-db`) through `deploy/dev/cloudsql-proxy.yaml`; aio-gitops `85d315c` switched `values-dev.yaml` to `EMBEDDED_DB=false`. The embedded data was restored from a `pg_dump` taken 2026-11-13 21:10 IST (1 user, 202 lessons, Flyway V3); a local copy of that dump is kept outside the repo.
- Open: configure `GCP_CONTENT_BUCKET` in each environment, and Cloud SQL databases plus `REELS_DB_*` for staging and prod.
  - Open: "recent" reels are ordered by ID because the API has no publish dates. Confirm, or add dates.
  - Open: check the reels feed height and the floating bar on a real phone and a tablet.

## Waiting on others

- **Settings consistency:** merged to `main` as PR #16 (commit `673e484`). Nothing left to raise.
- **Reels follow-up:** merged to `main` through PRs #18 to #20. Nothing left to raise.
- **Remote branch cleanup:** deleting merged remote branches was blocked by the permission checker. Needs a manual run or a permission rule.
- **Member date:** "Member since" can show today's date. Code looks correct; needs this query run against the database: `SELECT id, email, created_at, oidc_sub FROM users ORDER BY email, created_at;`

## Accessibility (details in docs/accessibility.md)

- Done: automated WCAG 2.2 AA scan with no violations on Home, Paths, Settings, lesson page and Reels (sample data); reading text contrast in every theme; no horizontal scrolling at 320 px.
- Waiting on you: the SEBI accessibility clause or circular, so it can be checked against the list.
- Needs a person: screen reader pass (VoiceOver, TalkBack, NVDA) on reels, the bottom bar and Settings.
- Needs the live backend: keyboard run through the whole app.
- Needs a laptop: browser zoom at 200% and 400%.

## Not yet checked

- Reader themes, the swipe fix and the Settings page on a phone and a laptop.
- Playfair Display readability for long lessons.
- Live database migrations: `docs/user-profile-manager.md` says to apply three auth SQL migrations, but the repo has four (000 to 003).

## Local leftovers to decide on

- Local branches: `chore/local-build-info`, `feat/reader-fonts`, `fonts`, `reader-fonts-pr`, `backup/*`, `msgfix-*`. Delete only those already merged.
