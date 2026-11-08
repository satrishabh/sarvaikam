# Learning and interview experience redesign

## Purpose and scope

This iteration turns the existing Learn frontend into a connected workspace for software engineers. It preserves the React/Vite app, backend APIs, Profile Manager integration, role permissions, private-resource flow, and AIO deployment model. It does not create or deploy a second website through Sites hosting.

The Sites skill was used for task-centered design, responsive implementation, and local preview/validation. The established navy/teal brand remains. SVG icons, a restrained dotted-grid visual, reusable topic/path cards, and shared controls provide consistency without a new UI framework or a large asset dependency.

## What changed

- **Overview:** a learning/practice introduction, three career-oriented paths, a real practice prompt, a useful skill preview, live catalogue search/subject filters, progressive topic loading, and business access entry.
- **Learning paths:** ordered backend, full-stack-foundation, and cloud/platform sequences resolved against available catalogue topics. Counts come from real data. Empty/unpublished topics are omitted from the path. The full-stack path explicitly starts with server-side foundations; frontend lessons are not claimed to exist.
- **Skill map:** subject cards expose topic names, lesson counts, a next action, and text states (Not started / In progress / Complete). Expandable topic lists and status/search filters replace unexplained segmented bars. Error/loading states do not masquerade as zero saved progress. Completion is described as learning activity, not skill mastery.
- **Interview workshop:** five real prep tracks with lesson links and related practice exercises. A selectable seven-session warm-up provides a specific next exercise without inventing scheduled dates or promising outcomes.
- **Practice room:** eight authored exercises covering coding, system design, SQL, behavioral answers, and cloud/DevOps. Each has a prompt, constraints, hints, a suggested timer, a reasoning area, an approach outline, and self-review criteria. Timer uses a deadline so browser background throttling does not accumulate clock drift. Reviews are self-assessments, not AI or grader results.
- **Lesson reader:** actual curriculum sidebar, mobile lesson disclosure, estimated reading time, adjustable text size, copyable code examples, a reflection prompt, resources, and usable previous/complete/next controls. A lesson cannot be toggled before its saved completion state has loaded successfully.
- **Navigation and performance:** accessible mobile menu, consistent footer, section anchor handling, and route-level lazy loading. The homepage no longer eagerly downloads the Markdown reader, content administration, and practice pages.

## Data boundaries

Published lesson text and catalogue data continue to come from content-service. Completed lessons continue to use progress-service. Large resource attachments use the previously implemented private GCP bucket integration when configured. No new account/identity store is introduced.

Practice answer drafts are stored only in the current browser, using a versioned key scoped by account and question (or guest). They are not sent to the API, shared across devices, or used to update lesson completion. Private-browser restrictions can prevent saving; the UI only announces a saved draft after local storage succeeds. Clearing notes asks for confirmation. Review checkboxes and reflection text remain in the page session and are labeled accordingly.

The selected path highlight and warm-up session are navigation aids for the current visit, not durable profile preferences. There is no code execution, automated assessment, recording, mock-interview booking, or readiness prediction.

## Content handoff

See [content-handoff.md](content-handoff.md). Authoring templates and an example of the supported new-topic seed shape are in [content-inbox](../content-inbox/README.md). Raw drafts and local assets are excluded from Git and Docker. Placing a file in the inbox does not publish it.

Next content priorities: expand the backend/coding/system-design pilot into deeper worked examples, add reviewed frontend foundations for the full-stack path, and provide runnable exercises, expected outputs, source references, reviewer details, and transcripts/captions for media.

## Validation

The implementation was type-checked and built with the existing TypeScript/Vite toolchain. Pure-data tests verify path resolution, completion semantics, real seed-topic references, and question configuration. Run them with `cd frontend && npm run test:learning`.

Playwright checks used the actual merged seed catalogue (9 subjects, 33 topics, 176 lessons) with mocked auth/content/progress APIs. Checked:

- Search matches, no-results state, and filter reset.
- Skill-map active/completed states, genuine empty states, and topic actions.
- Lesson completion persistence through the mocked API and reading-size controls.
- Practice timer controls, hint reveal, self-review, and draft restoration after reload.
- Catalogue and progress failures/retry, with no false zero-progress summary.
- Mobile navigation and all seven primary learning routes at 390px and 320px without horizontal page overflow.
- Desktop rendering and browser runtime errors.

Screenshots are in the ignored `.cache/learning-*.png` files. Mocked browser checks do not prove deployed backend or GCP behavior. Backend implementations were not changed in this iteration, so their already-passing suites were not rerun solely for the visual redesign.

## Remaining work

A complete learning product needs maintained, technically reviewed content, learner feedback, real exercises/projects, and an editorial review cycle. This redesign supplies a stronger experience around the current content; it does not label the platform “best in the world,” fabricate customer ratings, or guarantee hiring outcomes.

Future capabilities should be driven by real use: structured prerequisites/outcomes, code-judge isolation, durable practice history, reviewed assessment rubrics, accessible media, screen-reader testing, and cross-device draft sync. A full dark appearance and a production assessment service are outside this iteration.

Deployment remains through the **sarvaikam** AIO project. The separate **sarvaikam-home** project is the marketing site and does not deploy the Learn frontend. No live rollout is performed by this redesign task.
