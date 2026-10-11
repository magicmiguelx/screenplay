# Video roadmap: <the app>

Made on <date> by surveying <what was read: README, guide, roadmap, the
e2e specs, the strings>. Method: `docs/planning.md` in the screenplay
kit. Estimates are from the kit's measured series (`docs/history.md`):
a three-minute tutorial records in five to ten minutes; writing it is one
to two hours and two or three takes.

## The audience and the promise

One paragraph: who the videos are for, what the product promises them in
its own words (from the site copy), and what it has measured and may
claim.

## What exists

For an app that already has videos: each one with its length and the
date it was last recorded, and the features it covers (crossed off
below). Skip the section for a first series.

| Track | Videos |
| --- | --- |
| start | 1 What is it (1:30, 2026-10-08) · 2 … |

## Tutorials

| # | Id | Track | File | Idea (after watching, the viewer can…) | Shows (feature: test that proves it) | Needs (fixtures, mocks, handles) | Target |
| -: | --- | --- | --- | --- | --- | --- | -: |
| 1 | overview | start | 01-what-is-it | …say what the product is in a sentence. | the editor: `app.spec.ts`; an example: `examples.spec.ts` | the signed-in account mock | 1:30 |
| 2 | … | | | | | | |

### Beats

For each tutorial, the beats in order, one line each, the action beside it:

**1 · What is it** (1:30)
1. Card: the title and blurb from the app's strings.
2. "Most diagrams are flat…" over an example loaded off camera.
3. …
4. Closing card: Next: <2's title>.

## Promos

| Id | Piece | Where shown | Audience | Beats | Borrows from | Target |
| --- | --- | --- | --- | --- | --- | -: |
| promo-20 | landing-page film | the hero's Watch link | a visitor who has not decided to read | hook (the problem) → reveal → beat → beat → offer | tutorials 1, 3, 7 | 0:20 |
| promo | sales piece | LinkedIn, outbound mail | <the buyer> | problem → reveal → 4 beats → offer | 1, 3, 7, 16, 17 | 1:30 |

## Words the voice needs rules for

Brand names, acronyms, numbers and currency, with the respelling or the
spoken form (`say` in `screenplay.config.mjs`): "<Brand>" → "<respelling>";
"<ACRONYM>" → "<A C R O N Y M>".

## Roadmap

### Phase 0 · Adopt the kit
- [ ] `screenplay.config.mjs` at the root (the voice, the `say` and `undo` rules, where the scripts and videos live).
- [ ] The list module the app and the spec read (`src/.../tutorials.ts`), with placeholder lengths.
- [ ] `tests/e2e/demos.spec.ts` and `promo.spec.ts` from the templates; the smoke test recorded once in this environment.
- [ ] Where the app serves the videos, and the test that every video and poster is served.

### Phase 1 · Fixtures and mocks
- [ ] The account the videos sign in with (an obviously fake one).
- [ ] The example data each video opens.
- [ ] The AI / payment stand-ins (blocked on: <what the app lacks>).
- [ ] Pictures drawn in a page and screenshotted.

### Phase 2 · The videos, in watching order
- [ ] 1 · What is it (`demos.spec.ts` "^1 ·"; needs: …)
- [ ] 2 · …
- [ ] promo-20 (after 1, 3, 7)
- [ ] promo (after the first track)

### Phase 3 · Checks and shipping
- [ ] `screenplay-voiceover check` on every video, the flagged lines listened to.
- [ ] Frame sheets of every video; the first and last card measured against the voice.
- [ ] Real lengths on the cards; the app's list, guide and README updated.

## Blocked on the app

What the app must add before an item above can be recorded (a stable
selector, a `window` handle, a mock, a kit feature its copy of the
recorder lacks, a measured number or a published rating for a proof
beat), each with the item it unblocks.

## Done

| Date | Item | Length | What was learned (went to the kit's playbook / history) |
| --- | --- | -: | --- |
