# Progress and to-do

Last updated: 2026-11-12

## In progress

- **Reels and floating bottom bar** (branch `feat/reels-floating-nav`, not committed)
  - Done: `/reels` page with swipe-up feed and right-swipe to open a lesson; bottom bar is now Home, Paths, Reels, Prep, More; Skills moved into More; floating pill bar, labelled on tablet; bar hides while scrolling and returns after about 0.9 s idle.
  - Done: sample reels in `frontend/src/mockReels.ts`, switched on by `frontend/.env.development` (`VITE_REELS_MOCK=true`). Production ignores it.
  - Open: remove the mock (`mockReels.ts`, `.env.development`, the `USE_MOCK_REELS` check in `ReelsPage.tsx`) once real content is wired up.
  - Open: "recent" is currently the newest by ID, because the content API has no publish dates. Confirm this, or add dates to the API.
  - Open: check the reels feed height and the floating bar on a real phone and a tablet.

## Waiting on others

- **Settings consistency:** merged to `main` as PR #16 (commit `673e484`). Nothing left to raise.
- **Reels follow-up:** PR #17 merged only the first reels commit (`f723479`). The later commits on `feat/reels-floating-nav` (full-screen reels, bar hidden on reels, small-screen text, position counter) are not in `main` yet. Open a PR from `feat/reels-floating-nav` to `main`: https://github.com/satrishabh/sarvaikam/compare/main...feat/reels-floating-nav
- **Remote branch cleanup:** deleting merged remote branches was blocked by the permission checker. Needs a manual run or a permission rule.
- **Member date:** "Member since" can show today's date. Code looks correct; needs this query run against the database: `SELECT id, email, created_at, oidc_sub FROM users ORDER BY email, created_at;`

## Not yet checked

- Reader themes, the swipe fix and the Settings page on a phone and a laptop.
- Playfair Display readability for long lessons.
- Live database migrations: `docs/user-profile-manager.md` says to apply three auth SQL migrations, but the repo has four (000 to 003).

## Local leftovers to decide on

- Local branches: `chore/local-build-info`, `feat/reader-fonts`, `fonts`, `reader-fonts-pr`, `backup/*`, `msgfix-*`. Delete only those already merged.
