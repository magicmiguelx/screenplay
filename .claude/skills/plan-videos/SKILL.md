---
name: plan-videos
description: Point the kit at an app repository and propose its videos: a list of tutorials in tracks and the promos, each with its idea, beats and what it needs, and a roadmap for making them in order. Use when asked to plan, suggest or scope videos for an app; /make-videos delivers the roadmap.
---

# Plan the videos for an app

You are given an app repository (a path on disk, or a repository to clone
beside this one). Produce `docs/video-roadmap.md` in that repository (or
where the person asks), in the format of `templates/video-roadmap.md`,
following the method in `docs/planning.md`. Read both first, and
`docs/playbook.md` section 1 (the shape of a video).

## 1. Survey the app (read, don't guess)

Read, in this order, and note what each says the product is for and does:

1. The README and any user guide or help pages: the features as the
   maker names them, in the order they are taught.
2. The site or marketing copy (a landing page, a `marketing.md`, the
   `<meta>` descriptions): the audience, the promise, the words the
   product uses for itself. A promo claims only what this says and what
   the product has measured.
3. The roadmap or changelog: what is built, what is half built, what is
   next. A video of a feature that is about to change is a re-recording.
4. The e2e tests: every feature with a passing test can be shown; its
   test is the script's skeleton (selectors, the fixtures, the mocks it
   needs). A feature without a test is a risk, not a video.
5. The UI strings (an i18n file, the menu labels): the names the cards
   must use, and titles that will read badly aloud.
6. What the app exposes for a driver (`window.*` handles in dev builds,
   stable classes or data attributes) and what it must never show (real
   keys, real emails, real payments): the mocks and fixtures the videos
   will reuse.

Do not run the app or record anything in this step.

## 2. Propose the list

- **Tutorials**: one idea each, one to three minutes, grouped in tracks
  watched in order (get started → bring data in → the advanced features →
  share and present is the usual arc; use the product's own order). The
  first is always "what is it", the idea in a minute. Fifteen to twenty is
  a full series; five to seven is a first track. No teasers: a feature with
  its own video is not previewed in an earlier one.
- **Promos**: a landing-page film of about twenty seconds (hook, reveal,
  two beats, offer), a sales piece of one to two minutes (the problem,
  the reveal, three or four beats, the offer), and, if the product has
  them, one per audience or per headline feature. Each names its audience
  and where it will be shown.
- For every video: id, group, file name, a one-sentence idea ("after
  watching, the viewer can…"), the beats (one line each, with the action
  beside it), the features it shows and the test that proves each, the
  mocks and fixtures it needs, a target length, and the words the voice
  will need `say` rules for (brand names, acronyms, numbers).

## 3. Write the roadmap

Phases, in order, each a list of items with what "done" looks like:

0. **Adopt the kit** (`docs/adopting.md`): the config, the video list
   module, the spec, the fixtures, where the app serves the videos, the
   tests that check them. Skip what the app already has.
1. **Fixtures and mocks** every video needs: the account, the example
   data, the AI and payment stand-ins, pictures drawn in a page.
2. **The first track**, then each later track, one video per item, in
   watching order; the promo after the tutorials it borrows from (its
   beats are their best moments). Each item: the video's id, its spec
   test, the fixtures it waits on.
3. **Checks and shipping**: `voiceover check` on every line, the
   quality checks (`docs/quality-check.md`), the app's list and guide
   updated, the served-files test.

Give each phase an estimate from the measured numbers in
`docs/history.md` (recording time per minute of video, lines per video),
not from guesses, and say what the estimate is based on. Mark the items
that need something the app does not yet have (a mock, a stable selector,
a `window` handle) as blocked on it, in the app's own terms.

## 4. Hand it over

Write the roadmap file, then answer in a few lines: how many videos, the
tracks, the promos, the first three items to do, and anything the app
must add before the first recording. Do not start recording unless asked:
that is `/make-videos`.
