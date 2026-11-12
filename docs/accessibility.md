# Accessibility

Last updated: 2026-11-12

## Standard we design to

**WCAG 2.2 Level AA** is the target for the whole product, including the reels, the bottom bar, the reader and Settings.

How it maps to the rules named in the request:

| Region | Rule | How this product meets it |
| --- | --- | --- |
| USA | ADA (web access through the courts) and Section 508 | WCAG 2.x AA is the accepted benchmark. |
| EU | European Accessibility Act (EAA), via EN 301 549 | EN 301 549 uses WCAG 2.1 AA. WCAG 2.2 AA covers it. |
| India | RPWD Act 2016 and GIGW 3.0 | Both point to accessible web content. GIGW applies to government sites. |
| India | SEBI | **Not verified.** I could not confirm a specific SEBI accessibility rule. Share the circular or the applicable clause and we will check it against this list. |

This is an engineering standard, not legal advice. A legal review is needed before claiming compliance.

## What has been checked

- Automated scan (axe-core, WCAG 2.0, 2.1 and 2.2 AA tags) on Home, Paths, Reels (error state) and Settings at 390 px width: no violations.
- Reels with sample data: the feed has a region label, arrow keys and Page Up/Down move one reel at a time, the position is text ("Lesson 2 of 4"), and "Open lesson" is a button alternative to the right-swipe gesture (WCAG 2.5.1).
- Floating bottom bar: visible labels for every tab, the current page is marked with `aria-current`, targets are at least 52 px tall, and a focused control is scrolled above the bar (WCAG 2.4.11).
- Reader themes include White, Dark and Device (follows the system light or dark setting). Contrast was not measured for every theme; see open items.
- Motion: the bar's transitions and reel scrolling are switched off when the device asks for reduced motion.

## Open items

- Manual screen reader check (VoiceOver on iOS, TalkBack on Android, NVDA on Windows) for the reels, the bar and Settings.
- Keyboard check of the whole flow with the sample data and with the live backend.
- Lesson pages were not scanned in this pass, because the backend is not running here.
- Text resize to 200% and zoom to 400% on a laptop.
- Colour contrast for the Warm and Slate themes was not measured.
- Captions and transcripts for any future video or audio.
- A published accessibility statement and a contact route for reporting barriers.
