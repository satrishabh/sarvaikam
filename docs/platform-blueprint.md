# Sarvaikam platform audit and blueprint

Status: proposal · November 2026

This document has two parts:

- **Part 1** records what is wrong today, with file references.
- **Part 2** proposes the target system: a modular monolith that brings these together:
  - learning,
  - content authoring from a blob store,
  - commerce,
  - DPDP-grade privacy,
  - a single design system.

---

## Part 1 — Audit

Each finding is rated by severity: **C** = critical, **H** = high, **M** = medium.

### 1.1 Security and sessions

| Sev | Finding | Where |
|---|---|---|
| C | A known HS256 secret (`change-me-to-a-long-random-secret…`) passes the ≥32-char startup check. `kubectl apply -k` ships it to prod, along with `POSTGRES_PASSWORD: change-me`. | `deploy/k8s/secret.yaml:13`, `kustomization.yaml`, `docker-compose.yml:34` |
| H | One shared HS256 secret across 3 services. Compromising any one of them lets an attacker mint an admin token. | auth, content, progress |
| H | Multi-tab refresh race: the refresh token rotates, but the de-dupe only works within a single tab. Users are logged out at random. | `frontend/src/auth.tsx:15` |
| H | The refresh rate limit is per IP and runs before the cookie check. On campus or office NAT, ordinary page loads trigger 429s. At 10k entries the limit returns 429 to everyone. | `session.controller.ts:15-25,62` |
| H | The ingress has no TLS, but the `Secure` cookie needs HTTPS. Teams are pushed toward `APP_ENV=dev`. | `deploy/k8s/ingress.yaml` |
| M | Logout problems: no redirect, other tabs are not signed out, the app JWT is not revoked, and personal localStorage data (practice notes, history, goals) is kept on shared PCs. | `App.tsx:245`, `SettingsPage.tsx:154` |
| M | If Keycloak returns 5xx on logout, the cookie is cleared anyway. The Keycloak session stays alive and the user cannot retry. | `session.controller.ts:80`, `auth.tsx:59` |
| M | content-service fails open (treats the user as anonymous) when `/me` is down. The docs say it fails closed. | `JwtAuthFilter.java:81` |
| M | Every request makes a synchronous call to `/api/auth/me`. auth-service is a single point of failure. | content + progress |
| M | Postgres is published on 5432/5433 with default creds. DB TLS is not verified. `DB_SYNCHRONIZE` defaults to true. | `docker-compose.yml`, `app.module.ts:24-29` |

### 1.2 Privacy (DPDP Act 2023 and DPDP Rules 2025)

What exists: draft legal pages with placeholders, an access-change audit log, and email verification.

What is missing:

- an itemised notice and consent at sign-up
- a consent record or ledger
- withdrawal of consent
- export, correction and erasure
- a grievance officer
- a nominee
- retention and purge rules
- a breach-notification runbook
- age gating and verifiable parental consent

Two items are inaccurate or overreaching:

- **H — data shared without consent.** `candidates.view` can be granted to BUSINESS. It then exposes every learner's email, organisation and progress without the learner's consent (`auth.service.ts:194-204`).
- **M — wrong notice.** The notice says reading preferences stay in the browser. They are stored server-side (`LegalPage.tsx:20`).

The draft privacy and contact pages are indexable (`website/privacy.html:20`).

### 1.3 Architecture and content

- **Three runtimes for roughly 2.5k lines of business logic.** Java, Node and Go each need their own toolchain, Dockerfile and auth logic. The all-in-one image runs supervisord, nginx and Postgres together.
- **Progress has no referential integrity to lessons.** It also creates its schema with inline `CREATE IF NOT EXISTS`, with no migrations.
- **Reels live in a separate database with logical foreign keys.** That adds a second Flyway setup inside a constructor, with no connection pool.
- **Lessons have no draft/publish state and no version history.** Saving a lesson publishes it. Every save also leaves an orphaned object in the bucket.
- **Seeding runs on every boot and only ever inserts.** Lessons deleted in the CMS come back, and fixes to the seed files never reach existing rows.
- **There is no way to drop content into blob storage and have it appear.** The only routes are the CMS or uploading to the bucket and hand-writing SQL (`docs/content-storage-structure.md`).
- **Observability is a health endpoint only.** There are no metrics, traces, request IDs or structured logs.

### 1.4 Storage adapters (uncommitted branch work)

These must be fixed before any S3/Azure rollout:

1. `docker/entrypoint.sh:81-88` rejects `s3` and `azure-blob`.
2. The copy job queries reels on the wrong database. Its error is swallowed and the job exits 0, so after cutover every reel loses its body (`ContentStorageCopyRunner.java:32,72`).
3. Abandoned uploads (`ready=false`) count as missing, so the copy job always exits 1 (`:30`).
4. The copy job also runs the seeders and the web server, and writes to the target store while production still reads the old one. It needs `web-application-type=none`, seeding turned off, and an explicit order.
5. The migrator reads each object fully into a `byte[]`. Assets of 2 GiB fail (`ObjectStoreMigrator.java:30`).
6. There is no per-key error handling. "Already exists" errors differ per adapter, so racing runs abort.
7. `lesson_assets.generation` is not rewritten after a copy, so GCS downloads return 404 after a migration or rollback.
8. The Azure upload SAS grants Write, so a holder can overwrite a blob after it was validated. It should grant Create only (`AzureBlobObjectStore.java:114`).
9. Azure fetches a new user-delegation key on every URL; it should be cached. Filenames are not RFC 5987-encoded in Content-Disposition.
10. The Azure SDK's Jackson 2 / Netty versions next to Boot's managed versions need a runtime smoke test.

### 1.5 Experience and design

- **Corrupted text was shipped in the UI** ("workspaceâ€¦", "doesnâ€™t"). *Fixed in this change* in `App.tsx` and `LessonPage.tsx`.
- **No learning loop.** There is no retrieval practice, quiz, spaced repetition, mastery check or capstone. Completion is a self-declared "Mark complete". The 8 practice questions are not saved.
- **Navigation overlaps.** Home duplicates Paths, Skills and the library. Practice is missing from the desktop nav. The library exists only as `/#topics`. Interview prep hardcodes question IDs.
- **No clear next step.** Momentum only resumes the last topic. A "my path" choice is forgotten. Finishing a topic sends the learner to a generic practice page.
- **The visual system is fragmented.** There are 93 hardcoded hex values and four "ink" colours. Four type families are mixed, including Archivo with SF and Playfair for reading. CSS is layered "passes". Dark mode exists only in the reader. The marketing site uses a different palette and wordmark.
- **Authoring problems.** There are no lesson drafts, autosave or versions. The preview does not match the reader. Ordering is done by number field.
- **No commerce at all.** There is no catalog, pricing, checkout or entitlement. nginx even sets `Permissions-Policy: payment=()`.
- **The Forward Deployed Engineering (FDE) course is thin.** It has one topic of 8 lessons of about 450 words each, with no case study, practice or capstone. The path reuses generic topics.

---

## Part 2 — Blueprint

### 2.1 Principles

1. **One deployable, many modules.** Module boundaries are enforced in code, not over the network.
2. **Content is data, delivered from the blob store.** The database is an index of releases, not the source of truth for prose.
3. **Learners prove skill instead of clicking "complete".**
4. **Privacy is a feature learners can see**, not a page they never read.
5. **Use one design language everywhere:** marketing site, app, reader, studio and email.

### 2.2 The modular monolith ("Sarvaikam Core")

The core is a Spring Boot 3 / Java 21 application with **Spring Modulith**. Module dependencies are verified in tests and modules communicate through in-process domain events. Events are persisted with a transactional outbox, so a purchase can never lose its entitlement. Keycloak (User Profile Manager) remains the identity provider; everything else moves in.

```text
                Browser / future mobile
                        │  same-origin, HttpOnly session cookie
                ┌───────▼────────────────────────────────────────────┐
                │ Sarvaikam Core (one JVM, one image)                │
                │                                                    │
                │  identity   consent    catalog    authoring        │
                │  sessions   ledger     paths      releases         │
                │  passkeys   rights     products   importer         │
                │                                                    │
                │  learning   assessment commerce   media            │
                │  progress   quizzes    orders     ObjectStore      │
                │  mastery    projects   entitle-   signed URLs      │
                │  FSRS queue grading    ments                       │
                │                                                    │
                │  reels      notify     admin      platform         │
                │                                   (outbox, audit,  │
                │                                    metrics, jobs)  │
                └──────┬──────────────────────┬──────────────────────┘
                       │                      │
              PostgreSQL 16              Blob store (GCS/S3/Azure/Drive)
         one DB, schema per module     inbox/ · releases/ · media/ · exports/
```

| Module | Owns | Replaces |
|---|---|---|
| `identity` | Server-side sessions (BFF), Keycloak OIDC code+PKCE, passkeys, "sign out everywhere", roles/permissions | auth-service (NestJS), the shared HS256 JWT |
| `consent` | Notices (versioned), consent ledger, rights requests, nominee, grievance tickets, retention jobs, breach log | — (new) |
| `catalog` | Categories, courses, paths, products and prices | content-service catalogue |
| `authoring` | Course packs, the importer, validation, draft → review → published releases, rollback | CMS save-is-publish, seed-on-boot |
| `media` | The `ObjectStore` SPI, content-addressed objects, signed URLs, the copy job | current storage adapters (fixed) |
| `learning` | Enrolments, progress, the mastery model, the spaced-repetition review queue, "Today" | progress-service (Go) |
| `assessment` | Checks, quizzes, coding tasks, FDE simulations, rubrics, certificates | static "check for understanding" |
| `commerce` | Orders, Razorpay (UPI/cards), GST invoices, coupons, team seats, refunds, entitlements | — (new) |
| `reels` | Reels as a release artifact type (same database, real foreign keys) | separate reels database |
| `notify` | Email, reminders, receipts; respects consent purposes | — |

Migration plan (strangler pattern):

1. Build the Core next to the existing services.
2. The gateway routes `/api/progress/*` to the Core first.
3. Then route `/api/auth/*`.
4. Retire the Go and Node services once their traffic reaches zero.

Moving from one database to one schema per module is done with Flyway in each module.

### 2.3 Content from the blob store: Course Packs and immutable releases

Authors drop a folder (or a zip) into `inbox/` in the blob store. Nothing goes live until someone presses **Publish**.

```text
inbox/forward-deployed-engineering/
├── course.yaml            # slug, title, path, level, price, outcomes, prerequisites
├── 01-what-fdes-do.md     # front-matter: slug, step, stage, exclusive, duration, sources
├── 01-what-fdes-do.check.yaml   # retrieval questions for this lesson
├── 02-discovery-calls.md
├── reels.yaml             # bite-sized reels with source attribution
├── projects/capstone.md   # capstone brief + rubric
└── media/architecture.png
```

The pipeline from upload to live course:

1. **Detect.** A bucket event (GCS Pub/Sub, S3 EventBridge or Azure Event Grid) or a 1-minute poll finds new packs. Drive uses polling.
2. **Validate.** The importer checks the schema, broken links, missing media, duplicate slugs, slug renames (which create a redirect), and missing source attribution. Problems appear in Studio as a readable checklist.
3. **Stage.** Each file is stored content-addressed (`objects/sha256/<hash>`), so identical bytes are stored once. A **release** row (`release_id`, `course`, `manifest`, `status=DRAFT`) is created, with a shareable preview URL.
4. **Publish.** One transaction flips `course.live_release_id`. Rollback flips it back. Old releases stay browsable, so every lesson has history.
5. **Garbage-collect.** Objects not referenced by any of the last N releases are deleted. This fixes the orphan growth and the `generation` mismatch.

Studio and the blob store write the same pack format, so authors can work either way. A GitHub repo synced to the bucket by CI is a third option. The FDE course and the interview packs become ordinary packs instead of hardcoded IDs.

### 2.4 Sign in and sign out

**Sign in.** The Core acts as a backend-for-frontend:

- It runs the Keycloak code+PKCE flow.
- It keeps the session server-side and gives the browser one `__Host-sid` cookie (HttpOnly, Secure, SameSite=Lax).
- No tokens are exposed to JavaScript, and the browser does no refresh loop, so the multi-tab race cannot happen.

Passkeys are offered as the primary method after the first login. Rate limiting moves to the ingress and is keyed on account and session, not only on IP.

**Sign out:**

1. Delete the server session, then revoke at Keycloak. On failure, the Core retries from the outbox; the user is never left half signed out.
2. Send `BroadcastChannel('auth')` so every open tab locks.
3. Clear user-scoped storage (`sarvaikam.u.<id>.*`).
4. Redirect to `/`.

"Sign out of all devices" is available in Settings.

**First paint.** The session is resolved in one server round-trip before the app shell renders, so the header no longer flickers between signed-out and signed-in.

### 2.5 DPDP by design: the Privacy Cockpit

Privacy is a visible screen under Settings, not a buried policy.

| DPDP obligation | Product feature |
|---|---|
| Itemised notice, specific consent (s.5–6) | At sign-up, short per-purpose cards: *Account* (required), *Learning analytics*, *Reminders*, *Share my skills with employers*, *Product research*. Each is off unless marked required. The notice is available in English and Hindi, plus other Schedule-8 languages as demand appears. |
| Consent record | An append-only `consent_ledger` (`principal, purpose, notice_version, action, at, channel, hash_chain`). Every grant and withdrawal is hash-chained, so tampering is evident. Users can download a receipt. |
| Withdraw as easily as given | The same toggles. Withdrawal fires a `ConsentWithdrawn` event, and every module stops processing for that purpose. |
| Access / correction / erasure (s.11–13) | One-click data export (a JSON plus a human-readable PDF, delivered as a signed URL in `exports/`, expiring in 7 days). Users edit profile fields directly. Erasure runs with a 30-day grace period and then cascades across modules. Data with a legal-hold exception, such as GST invoices, is minimised instead of deleted. |
| Nominee (s.14) | Users nominate a person who can exercise their rights. |
| Grievance redressal | A grievance officer is listed on every page. Each ticket gets a tracking number and a response SLA. |
| Children (s.9) | An age declaration at sign-up. Under-18 accounts need verifiable parental consent before activation. There is no tracking or targeted outreach for minors. |
| Retention | Per-purpose retention: inactive accounts get a 3-year notice and then erasure. The jobs live in `consent`. |
| Breach | A security event log, an incident runbook, and templates to notify the Data Protection Board and affected users. |
| Employer access | `candidates.view` is replaced by **opt-in talent sharing**. Employers see only learners who granted that purpose, and only the fields they chose. Learners see who viewed them. |

### 2.6 Selling courses: commerce built on entitlements

- **Products**:
  - a path,
  - a course,
  - a bundle,
  - Pro (a monthly or annual subscription),
  - team seats.
- **Content access asks one question**: does this user have an entitlement for this course? Payments, coupons, team admin grants and the "business access" programme all simply *create entitlements*.
- **Checkout**:
  - Razorpay, covering UPI, cards, netbanking and EMI.
  - Webhooks are verified, and the `Order → Paid → EntitlementGranted` chain runs through the outbox.
  - A GST-compliant invoice is generated as a PDF.
  - Refund rule: a 7-day full refund if the learner has finished less than 20% of the course.
- **Try before you buy**: every course has free lessons in its Starter stage. Learners see the full syllabus, a sample lesson and the capstone brief before paying.
- **Proof that sells**: a course ends with a **Skill Passport** entry, a verifiable credential (signed JSON plus a public page). It cites the assessed artefacts, not just a completion date.

### 2.7 A learning engine based on proof of skill

Patterns borrowed from the best learning products, combined:

| Pattern | Reference | In Sarvaikam |
|---|---|---|
| Retrieval practice inside lessons | Brilliant, Khan Academy | Every lesson ends with 2–4 checks. "Complete" means you passed them, not that you clicked. |
| Spaced repetition | Anki (FSRS), Duolingo | Missed and learned items enter an FSRS review queue. The **Today** screen shows at most 10 minutes of review plus your next lesson. |
| Mastery per skill | Khan mastery, knowledge tracing | Each skill shows a level based on evidence (*Learned → Practised → Proven*), not a percentage. |
| Real projects | Exercism, Frontend Masters | Each course has a capstone with a rubric, self-review and peer review. AI-assisted feedback comes later. |
| Cohorts and accountability | Maven, reforge | Optional time-boxed cohorts for paid paths. |

**The new idea: Field Simulations for Forward Deployed Engineers.** No platform today trains the FDE job itself, because the job is defined by working in ambiguity with a customer. A simulation is a timed scenario with four parts:

- **A customer brief.** An LLM plays the customer's stakeholders: a sceptical CTO, an ops lead with messy data, and a compliance officer.
- **An artefact bundle.** For example, a CSV export, a broken integration log and an API spec.
- **Hidden constraints** that the learner has to discover by asking questions.
- **A deliverable.** For example, a scoping doc, a working integration, or a "what I'd ship Monday" memo.

Grading uses a rubric covering discovery questions asked, constraints found, quality of the solution, and communication. The transcript and deliverable go into the Skill Passport as evidence. The same engine serves system-design and behavioural interview practice. This turns the thinnest course into the flagship.

### 2.8 Design system: "quiet, typographic, alive"

The reference is the restraint of Apple's Human Interface Guidelines, not their visual assets.

**Typography:**

- One family for everything: **Inter**, with **Inter Display** for headings.
- **JetBrains Mono** for code.
- Reader option: Literata as a serif for long reads.
- Playfair and Archivo are dropped.
- Six-step type scale: 13/15/17/22/28/40, line-height 1.5 for body text.

**Colour:**

- Defined only as semantic tokens: `surface`, `surface-raised`, `ink`, `ink-muted`, `line`, `accent`, `success`, `warning`, `danger`, `focus`.
- One accent, Sarvaikam orange, used **only** for the primary action and progress.
- Light, dark and high-contrast themes app-wide, not just in the reader.
- A lint rule bans raw hex values outside `tokens.css`.

**Spacing and shape:**

- A 4/8 px grid.
- Corner radii of 8 for controls, 14 for cards and 20 for sheets.
- No cards nested inside cards.
- At most one eyebrow label per screen.

**Motion:**

- Spring-based transitions of 180–260 ms that respect reduced motion.
- Shared-element transitions from a course card to the course page.
- No infinite loops.

**Each screen has one job and one primary action:**

| Screen | Job |
|---|---|
| **Today** (home, signed in) | Continue · Review (n) · Your path |
| **Explore** (home, signed out, plus the catalogue) | The paths, then the course page with syllabus, price and a free lesson |
| **Course** | Syllabus by stage, mastery, projects, purchase or continue |
| **Lesson** | Reader, inline checks, next |
| **Practice** | Review queue, simulations, interview drills (merges today's Practice and Interview prep) |
| **You** | Skill Passport, progress, Privacy Cockpit, billing |
| **Studio** | Packs, releases, preview, publish, analytics |

**Shared across surfaces.** The marketing site, emails and invoices consume the same tokens from `design-tokens.json`, generated into CSS variables and a Tailwind preset.

**Accessibility:**

- Focus moves to the `<h1>` on every route change.
- An aria-live region announces route changes.
- Modals and the card deck trap focus.
- Contrast meets WCAG 2.2 AA, verified in CI with axe.

### 2.9 Operations

- One image and one Helm chart.
- Ingress with TLS through cert-manager.
- Secrets from a cloud secret manager through External Secrets. The service refuses to boot with any known default secret.
- OpenTelemetry traces, metrics and logs. Every response carries `X-Request-Id`.
- Flyway for every module, with the migration job run before rollout.
- Preview environments per PR.
- Data residency: host in an Indian region (GCP `asia-south1`, AWS `ap-south-1` or Azure Central India) and state the location in the notice.

---

## Part 3 — Roadmap

| Phase | Scope | Size |
|---|---|---|
| **0. Stop the bleeding** | Rotate the secret and drop `secret.yaml` from kustomize. Refuse known secrets. TLS ingress. Close DB ports. Fail closed. Logout redirect, broadcast and storage wipe. Fix the refresh limiter. Fix storage adapter bugs 1–8. Publish real legal pages with a grievance contact; noindex until then. | ~1 week |
| **1. Core skeleton** | Spring Modulith app. `identity` as a BFF with server sessions. Move `learning` (progress) in. Strangler routing. One design-token pipeline. | 2–3 weeks |
| **2. Content releases** | Course Pack format, the blob importer, drafts and releases, rollback, content-addressed GC. Studio rebuilt on packs. Retire seed-on-boot. | 2–3 weeks |
| **3. DPDP** | Consent ledger, Privacy Cockpit, export and erasure, nominee, grievance, age gate, opt-in talent sharing, retention jobs. | 2 weeks |
| **4. Commerce** | Products, Razorpay, entitlements, GST invoices, coupons, team seats, catalogue and course pages. | 2–3 weeks |
| **5. Learning engine** | Inline checks, FSRS queue, mastery, Today screen, capstones, Skill Passport. | 3 weeks |
| **6. FDE flagship** | Field Simulation engine, plus a 4-week FDE pack with 3 simulations and a capstone. | 3–4 weeks |
| **7. Visual rebuild** | Apply the design system across every screen, the marketing site and emails. Runs alongside phases 2–5. | ongoing |

Phases 0 and 1 unblock everything else. Phases 3 and 4 must ship before taking the first rupee: selling to learners without a DPDP-grade consent and refund flow is a legal risk.
