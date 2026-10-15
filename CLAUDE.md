# Screenplay

Scripted, narrated product videos recorded from the app itself with
Playwright, an overlay (cursor, captions, cards), the DevTools screencast,
ffmpeg and an ElevenLabs voice kept on the picture; and the playbook of
what was learned making nineteen of them. `README.md` is the map.

## When a session is about planning an app's videos

Pointed at an app repository (cloned beside this one, or a path), the
`plan-videos` skill (`.claude/skills/plan-videos/SKILL.md`, method in
`docs/planning.md`) surveys it and writes its `docs/video-roadmap.md`
(`templates/video-roadmap.md`): the tutorials in tracks, the promos, what
each needs, the order. Survey what the app says and its tests prove;
never guess a feature. `make-videos` delivers the roadmap, one video at a
time by the checklist below, and ticks it as it goes.

## When a session is about making a video (in any project)

1. Read `docs/playbook.md` first, then `docs/new-video-checklist.md`, and
   work down the checklist. `docs/writing-for-the-ear.md` before writing
   any line's spoken text; `docs/quality-check.md` before calling a
   recording done.
2. The rules that are not negotiable, because each was paid for:
   - The voice is placed by the frames (`Timeline.videoTime`), never by
     the wall clock; a line is logged once it is in the picture
     (`painted()`); the closing card is held to the end; the last line is
     never cut short.
   - Every line has a spoken text written for the ear; brand words and
     acronyms are fixed once in the project's `say` rules; a recording is
     not done until `screenplay-voiceover check` has been run and its
     lines listened to.
   - A promo is written to its length first: a twenty-second film is a
     hook, a reveal, two beats and the offer, in fragments of six to
     nine words, and nothing in it waits for a caption to be read.
   - Video specs are skipped unless asked (`DEMOS=1`, `PROMO=1`), use
     the app's mocks (no real AI calls, no real payments), and the voice
     key is never in CI.
   - Slow mechanics are cut (`rec.pause()` / `resume()`); smooth moves are
     drawn frame by frame (`drawFrames`, `orbit`); browser full screen is
     refused.
   - The overlay is installed with `Demo.prepare()` before the first
     navigation and the page is loaded with `page.goto()` (init scripts
     do not run for `setContent()`); the driver throws if it is missing.
   - A user-facing change the videos show re-records them; a recorder
     change re-records all of them.
   - The voice has a speed limit: a line is spoken at no more than
     `maxWordsPerSecond` (default 3, 180 words a minute); a faster clip
     is made again slower, and one still too fast at the slowest speed
     fails the take (every such line named when the take is saved), to
     be given a pause or fewer words (the
     owner's rule, 12 October 2026: the fast lines were heard as sped
     up).
   - A caption sits where it covers the least: the overlay measures the
     page's own content under its box at the bottom and the top and the
     driver takes the emptier (a corner when both are busy and a corner
     is clear), moves it off anything the line then clicks
     or spotlights, and logs the cover in the script's "Over" column;
     `maxCover` fails a take on a line over it (the owner's rule, 12
     October 2026: captions had covered what the line was about).
   - What a line is about is in the picture while it is said: named
     with `about` (brought into view first) or acted on before the line;
     the driver measures each line's subject (its `about`, the
     spotlight, its first action's target), logs it in the script's
     "Seen" column, and `minInView` fails a take on a line under it
     (the owner's rule, 14 October 2026: the focus of a line was cut off
     at the bottom of the frame).
   - Nothing in the picture is tilted on purpose: no rotated picture
     card, no drawn page at an angle in a hook picture, no transform on
     a still (the owner's rule, 12 October 2026; a one-degree tilt read
     as a skewed frame).
3. Claim in a video only what the product has measured.
4. When something new is learned (a word the voice mishears, a timing
   problem, a headless quirk), add it to the playbook and to
   `docs/history.md` with the date, in the same change as the fix.

## Developing the kit itself

- Work on `main` and push it; no feature branches or pull requests (the
  owner's rule, October 2026).

- `src/` is TypeScript, ESM, compiled to `dist/` by `npm run build`
  (`prepare` runs it on install, so a git dependency works). Keep it
  app-agnostic: anything that reads an app's own state (a node's
  position, a store) is the project's, as `src/three.ts` shows for a
  three.js scene; the driver takes functions and locators.
- `src/overlay.ts` runs in the page: no imports, no closures over the
  test process, options serialised through `addInitScript`.
- `src/timeline.ts` is pure and unit-tested; a change to how frames,
  cuts or holds are timed gets a test in `tests/unit/timeline.test.mjs`.
  So is `src/subjects.ts` (which line a subject's measurement belongs
  to, for "Seen" and `minInView`): a change to it gets a test in
  `tests/unit/subjects.test.mjs`. Keep decisions in the pure modules and
  the browser work in `demo.ts`.
- `npm run typecheck`, `npm run test:unit` and `npm run test:smoke` (a
  real recording of a small page: Chromium and ffmpeg) before a push.
  The smoke test asserts the opening card's time and the video's length,
  which is what catches an overlay or timing regression.
- Docs are part of every change: a new option goes in the playbook or
  the adopting guide; a new rule goes in the playbook with its reason and
  in the history with its date.
- No new dependencies without a reason; the kit has none at runtime
  beyond Playwright.
