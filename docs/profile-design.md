# Profile experience: design rationale and review

## Design thinking

The audience has three distinct jobs: learners want to begin without waiting, businesses want clear access and review status, and administrators need enough evidence to make accountable decisions. The design keeps those jobs visible through a small set of familiar screens. Its thesis is **make access understandable at the point a person needs it**. Sarvaikam's navy typography, teal actions, and numbered learning language provide the visual identity.

### Understand and define

The existing application already offers topic discovery, step-based learning, and a progress map. Preserve those strengths. The main friction was that identity lived behind a separate hosted UI, business membership had no explicit state, and administration was limited to lesson editing. A learner should not have to understand Keycloak, tokens, cloud storage, or role identifiers to use the product.

The core needs are:

- A normal learner can register, verify email, and start without manual approval.
- A business applicant sees what information is required, what happens next, and whether review is pending, approved, or declined.
- An administrator can review evidence, give useful feedback, change access, and inspect a record of changes.
- A content editor can distinguish standard and exclusive lessons and attach large resources with visible upload progress.

### Explore and implement

Use the existing React/Tailwind component vocabulary instead of introducing a second design system. Login is a focused form beside a short account-benefit explanation. On mobile the form comes first. The profile places identity and current access together, with the application as its main task. Profile management separates people, role permissions, and the audit log so routine review is not buried among settings. Content studio keeps the lesson sequence beside the editor and exposes resource uploads only after the lesson is saved.

State transitions are explicit:

| Current state | Action | Result and recovery |
|---|---|---|
| No account | Create account | Verification notice; resend email available |
| Unverified identity | Sign in | Explain verification requirement; offer resend |
| Normal account | Apply for business | Pending; standard learning remains available |
| Pending | Admin approves | Business role; exclusive access without payment |
| Pending | Admin declines | Normal role; review feedback and reapply action |
| Approved business | Admin changes role or suspends | Current APIs honor updated access |
| File uploading | Progress reaches 100% | Verify metadata before announcing completion |
| File uploaded, verification temporarily unavailable | Retry verification | Retry without uploading the file again |
| No matches or no resources | Empty state | Explain the state and the next useful action |

Native HTML controls provide keyboard, autofill, password-manager, and browser-validation behavior. Inline messages preserve context and avoid interrupting ordinary tasks. Deleting lessons/files uses explicit confirmation because the action is irreversible. No payment language is introduced into the business approval journey beyond explaining that access is free.

## Open-source design workflow

[Penpot](https://penpot.app/) was selected from the [open-source design tools directory supplied for this task](https://openalternative.co/categories/misc/design-prototyping/ui-ux-design). It is a design/prototyping tool, not a runtime UI dependency. The app remains React and Tailwind.

[`frontend/design-tokens.json`](../frontend/design-tokens.json) is a Penpot-compatible token set. Tailwind reads its color values directly, making the palette shared by code and design. Import this JSON using Penpot's Tokens panel; the top-level Sarvaikam key is the token-set name. Penpot documents this import shape in its [design token guide](https://help.penpot.app/user-guide/design-systems/design-tokens/).

Suggested prototype boards: Login desktop (1440), Login mobile (390), Profile normal, Profile pending, Profile declined, Profile business, People directory, Application review, Role permissions, Content studio, and Resource upload states. Build field, action, badge, surface, and message components from the shared tokens. No Penpot project was created or connected during this implementation; the handoff consists of shared tokens, working screens, this rationale, and local browser screenshots.

## Design review

### Summary

Good based on source inspection and browser checks of the new screens. The design is a quiet account/workspace utility that extends the existing learning experience. It prioritizes clear role/state language, bounded forms, and visible outcomes. The Apple Design Skill supplied for the task was applied to web foundations; native iOS/macOS navigation rules are not treated as web requirements.

### What works

- The mobile login form precedes promotional explanation, reducing scrolling before the main task. This follows `layout.md > Visual hierarchy`: “Order content by relative importance.” [Reference](https://github.com/dickwu/apple-design-skill/blob/main/references/hig/layout.md)
- Primary actions use a consistent teal; warning text uses danger with explicit wording. Body text and field labels keep navy/muted hierarchy without thin weights. `typography.md > Ensuring legibility`: “Avoid light font weights.” [Reference](https://github.com/dickwu/apple-design-skill/blob/main/references/hig/typography.md)
- Buttons and fields use at least 44px controls, with focus rings and native keyboard controls. Profile state is expressed in words, never solely in color. `accessibility.md > Vision`: “Support larger text sizes.” [Reference](https://github.com/dickwu/apple-design-skill/blob/main/references/hig/accessibility.md)
- Verification, pending review, successful approval, and upload outcomes use inline feedback close to the task. `feedback.md > Best practices`: “Make sure all feedback is accessible.” [Reference](https://github.com/dickwu/apple-design-skill/blob/main/references/hig/feedback.md)
- People can explore the public library before creating an account. `managing-accounts.md > Best practices`: “Delay sign-in for as long as possible.” [Reference](https://github.com/dickwu/apple-design-skill/blob/main/references/hig/managing-accounts.md)

### Contrast evidence

Computed from the actual palette using sRGB relative luminance:

| Foreground / background | Ratio |
|---|---:|
| Ink `#12325A` / white | 12.89:1 |
| Muted `#4A5A70` / canvas `#F6F7F9` | 6.56:1 |
| Accent `#0C7279` / white | 5.68:1 |
| Danger `#B4232F` / white | 6.52:1 |

These combinations exceed 4.5:1 for normal text. The accent was darkened to make small links and white action text readable. Status gold remains decorative; completion is also written in text.

### Craft notes

The numbered account benefits echo step-based learning without adding a competing illustration system. Admin review uses the same surface, field, and button language as the learner profile. Exclusive access is marked on the topic sequence before a person opens a restricted lesson. Permission descriptions explain concrete capabilities rather than presenting backend identifiers.

### Remaining improvements and limits

- **Medium:** The activity log uses stable actor/target identifiers. Names and emails can be added to improve scanning while retaining the identifiers as evidence.
- **Medium:** The existing product palette remains a light appearance. A full dark appearance needs token variants and visual verification across existing learning/progress screens; this work does not claim to provide it.
- **Medium:** Identity-provider verification/reset action pages still use the separate service's presentation. A custom theme in that repository is needed for identical branding throughout those email journeys.
- **Low:** Further testing with screen readers, 200% browser zoom, long translations, and users completing real business reviews would strengthen the review. Browser checks covered normal desktop/mobile widths, labels, loading/error states, registration password mismatch, approval, role-policy editing, and business application submission with mocked APIs.

Browser screenshots for this implementation are in `.cache/login-desktop.png`, `.cache/login-mobile.png`, `.cache/admin-permissions-desktop.png`, and `.cache/profile-mobile.png`. This directory is intentionally excluded from version control. Screenshots and mocked browser tests do not prove live email delivery or GCP connectivity.
