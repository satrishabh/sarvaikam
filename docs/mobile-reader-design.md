# Mobile app shell and reader design

## Direction and review

This iteration applies the user-supplied `frontend-design` guidance to a specific task: a software engineer should be able to open Learn on a phone, find the next task, and read comfortably. The previous desktop hero and expanded page navigation delayed that task on mobile. The revised design puts learning actions first and uses a single quiet reading surface instead of surrounding the article with repeated cards and labels.

The AIO mobile implementation was inspected in `platform/frontend/src/App.jsx` and `platform/frontend/src/appearance.css` in the local AIO checkout. Its compact top bar, safe-area spacing, side navigation, background scroll lock, Escape handling, and focus restoration informed the new shell. No AIO files were changed.

The compact design plan:

- Palette: navy `#12325A`, teal `#0C7279`, canvas `#F6F7F9`, white `#FFFFFF`, paper `#F6F0E3`, night `#14212C`.
- Typography: the established system sans for navigation and application UI; an optional Georgia book face for the article; monospace for code. Articles are limited to 68ch on desktop and the available safe width on mobile.
- Structure: a compact app header, persistent task navigation, and details in a focused drawer. The article is the distinctive surface; other controls stay restrained.
- Restraint: the tall desktop introduction is hidden on mobile; decorative path metadata and repeated section labels are reduced there. Actual lesson ordering remains visible because it carries meaning.

```text
Mobile home                         Mobile lesson
+-----------------------------+     +-----------------------------+
| Brand          Account Menu |     | Brand          Account Menu |
| What will you learn next?   |     | Lesson details     Settings |
| [Find a path] [Practice]    |     | Title / reading information |
| [Find a topic]              |     |                             |
| Continue / learning paths   |     | Article, examples, tables   |
| ...                         |     |                             |
| Home Paths Prep Skills More |     | Previous   Complete   Next  |
+-----------------------------+     +-----------------------------+
```

The plan was revised to keep one persistent bottom control surface at a time. Standard pages use the app tabs; lesson pages replace them with lesson actions. The reader's appearance applies only while a lesson is open, so choosing Night does not unexpectedly recolor account administration.

## Implementation

- Mobile/tablet app navigation below 1024px, with Home, Paths, Prep, Skills, and More.
- AIO-inspired modal drawer for navigation/account details, using native dialog semantics plus explicit keyboard wrapping. Background interaction is inert, page scrolling is locked, Escape/backdrop/close work, focus returns to the trigger, and changing routes closes navigation.
- Safe-area spacing on the header, navigation, reader controls, and drawers; dynamic viewport-height drawer layout and an independently scrolling drawer body.
- Compact mobile homepage with path/practice/search actions. Signed-in continue-learning appears ahead of the habit panel.
- Reader details drawer with the real lesson sequence and completion markers.
- Saved reader preferences: 16/18/20/22px article type, Modern/Book font, Comfortable/Compact spacing, and Day/Paper/Night appearance. Invalid or blocked local storage falls back safely. Preferences do not change server-side account data or completed lessons.
- Article scroll-position indicator, explicitly separate from lesson completion. Code and tables can scroll horizontally inside the article and are keyboard-focusable; code has a copy action and a visible swipe hint.
- Mobile practice Question/Answer panels preserve the same draft and session state. Exercise selection is collapsible. Desktop keeps the side-by-side prompt and answer.
- Mobile navigation hides when the visual viewport indicates an on-screen keyboard covering a focused text input. Browser behavior varies; real-device keyboard checks remain useful.

No native app packaging, service worker, offline content cache, or installation promise is added. Authentication, permissions, content, resource access, and progress endpoints remain unchanged.

## Validation

- TypeScript checks and Vite production build.
- Seven data/preference tests, including malformed stored settings, round-trip persistence, and blocked browser storage.
- Chromium mobile emulation with touch at 320x740 and 390x844; tablet at 768x1024; landscape at 844x390. Overview, paths, skills, prep, practice, topic, lesson, and login routes had no horizontal page overflow.
- Drawer scroll lock, forward/backward keyboard focus wrapping, Escape focus restoration, curriculum navigation/close, saved settings after reload, theme cleanup after leaving the reader, and preserved practice drafts between panels.
- Horizontal code scrolling stays within the code region. Night-mode controls and settings-drawer text retain readable contrast. Desktop route/navigation and side-by-side practice remain available.

The browser checks use the real seed catalogue with mocked auth/content/progress responses. They do not verify the live deployment, real iOS/WebKit behavior, physical notches, or every on-screen keyboard. A physical iPhone and Android acceptance pass is still recommended, especially after deployment.

Review images are saved locally in the ignored `.cache/` directory: `mobile-app-home.png`, `mobile-app-drawer.png`, `mobile-app-reader.png`, `mobile-reader-paper.png`, `mobile-reader-night.png`, `mobile-reader-settings.png`, and `mobile-practice-answer.png`.

Deployment remains through the **sarvaikam** project in AIO. This code change does not perform a live rollout.
