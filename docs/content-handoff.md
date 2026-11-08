# Content handoff for Sarvaikam

The redesigned experience is focused first on software engineers: backend, full-stack, cloud, coding, system design, SQL, and behavioral interviews. The current catalogue has 33 topics and 176 seed lessons. These are starting material, not a claim of complete coverage or guaranteed interview outcomes.

## Where to put what you provide

| Material | Authoring / handoff location | Published storage | How it appears |
|---|---|---|---|
| Lesson drafts, outlines, explanations, worked examples | `content-inbox/drafts/<topic-slug>/` in this workspace | PostgreSQL through Content studio | A readable lesson in the topic sequence |
| New catalogue content intended to ship with the application | Reviewed seed JSON under `services/content-service/src/main/resources/seed/` | PostgreSQL, loaded at service startup | New categories, topics, and lessons |
| PDFs, videos, slide exports, ZIPs, starter repositories | `content-inbox/assets/<topic-slug>/` for local handoff; upload through Content studio after GCP is configured | Private GCP bucket; metadata in PostgreSQL | Resources attached to an authorized lesson |
| Source references, provenance, author, review date, reuse permission | Alongside each topic draft; see `lesson-template.md` | Editorial source record in Git after review | Citations in the lesson where appropriate |
| Structured exercises for the current practice room | Reviewed entries in `frontend/src/practice.ts` | App source; current room ships 8 exercises | Timed questions, hints, approach outline, and self-review |
| A learner's practice answer draft | Entered in the practice room | That browser's local storage, scoped by account/question | Restored draft in that browser; not uploaded |
| Lesson completion | Mark complete in the lesson reader | Progress-service database | Skill map and learning-path progress |

Raw drafts and large local assets are ignored by Git and Docker. Do not put credentials, private employer code, customer data, unlicensed course copies, or the 1.4 GB ZIP into the source repository. The existing ZIP has not been moved, uploaded, or published. For large handoffs, a GCP bucket upload or an accessible storage link is preferable to a Git commit.

Seed loading inserts missing records. **Editing a seed file does not overwrite a lesson already edited or loaded in the database.** Use Content studio/API for updates to published lessons. A new category/topic can be created through the existing content administration API; the current lesson editor chooses from existing topics.

The temporary inbox is an authoring handoff convention, not an automatic importer. Nothing placed there is published until reviewed and added through the supported CMS or seed format. Markdown front matter in the editorial template is not parsed by the CMS; publish only the lesson body.

## What to provide first

Start with one complete, reviewed topic pack. A focused pilot is more useful than hundreds of disconnected files.

1. **Coding patterns:** arrays/maps, two pointers, sliding windows, stacks, trees, graphs, dynamic programming. Include a precise problem statement, constraints, examples, edge cases, a baseline approach, a better approach, complexity, and tests. Say which languages are supported.
2. **System design:** requirements, explicit scale assumptions, APIs/data model, a readable architecture diagram, trade-offs, failures, observability, and follow-up prompts. Include a review rubric rather than one supposedly perfect design.
3. **Backend:** language and framework fundamentals, API design, validation, transactions, caching, queues, testing, and one runnable service project. Include commands, prerequisites, expected output, and version information.
4. **Cloud and delivery:** containers, deployment, infrastructure as code, pipelines, reliability, and incident scenarios. Provide safe lab instructions, cleanup steps, and clearly labeled resource costs when applicable.
5. **SQL:** a small schema and sample data, the expected output, multiple query approaches where useful, tie/null/timezone assumptions, and executable verification cases. Identify the SQL dialect.
6. **Behavioral:** anonymized prompts, story-building worksheets, specific example structures, follow-up questions, and a rubric for clarity, ownership, evidence, and reflection.

For each topic, also provide: the intended learner level, prerequisites, 3–5 learning outcomes, an ordered lesson list, the author, references, the last review date, and the content-access choice (standard or exclusive). For each attachment, include its filename, purpose, format, captions/transcript if relevant, and permission to publish it.

## A practical first pack

Suggested starting point: **Backend interview foundations**.

- One overview with clear prerequisites and outcomes.
- Four to six lessons covering API design, SQL/transactions, caching, and service reliability.
- Two runnable worked examples with tests and expected results.
- Four interview prompts with hints, an approach outline, and self-review criteria.
- One small capstone project with acceptance criteria and a review checklist.
- Optional PDF notes and diagrams; videos need a transcript or captions.

Copy `content-inbox/lesson-template.md` for each lesson. Use `content-inbox/topic-pack.example.json` as the supported seed shape for **new** content. Existing lessons should be updated through Content studio, keeping stable slugs when their URLs should remain the same.

## Content quality and review

Before publishing, verify that examples run, constraints are explicit, explanations show the reasoning, all borrowed material is attributed and permitted, links work, code has meaningful tests, and diagrams have a text explanation. A second reviewer should check technical correctness and the learner's ability to follow the steps. Record review dates and flag version-sensitive content for later maintenance.

The practice room currently provides self-review, not an online code judge, AI grading, recording, or a human mock-interview booking service. Introducing those features requires dedicated execution infrastructure, reviewed assessment criteria, and privacy/security design. The interface does not claim that these services exist.

## Improvements after the pilot

Prioritize based on real learner feedback: missing prerequisites, confusing exercises, abandoned lessons, inaccurate examples, or unclear next actions. A later content model can add structured prerequisites, outcomes, exercise cases, provenance/review metadata, and durable practice history. The current redesign uses the available catalogue and completion API without inventing those database fields.

GCP infrastructure, workload identity, and storage origins still need to be configured before large resource uploads work. See `docs/user-profile-manager.md`. No infrastructure was provisioned by this design change.
