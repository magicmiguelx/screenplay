# Adopting the kit in a project

What a project needs before its first video, and the two ways to take the
code. Which videos to make, and in what order, is `docs/planning.md`
(`/plan-videos` writes the roadmap; `/make-videos` works it, starting
with the steps below).

## Needs

- Node 20+, Playwright (`@playwright/test` 1.45+) with Chromium, and
  **ffmpeg with libx264** and **ffprobe** on the PATH (`FFMPEG` /
  `FFPROBE` name other binaries). A headless run of a WebGL app wants
  Chromium's software renderer flags (`--use-gl=angle
  --use-angle=swiftshader --enable-unsafe-swiftshader`); a plain page does
  not.
- For the voice: an ElevenLabs account and `ELEVENLABS_API_KEY` in the
  environment of the person recording. Never in CI.
- The app in development mode, with whatever handles the specs need
  (`window.three`, a store on `window`) exposed there.

## Taking the code

**As a dependency** (the kit is built on install by its `prepare`
script):

```sh
npm install -D github:magicmiguelx/screenplay
```

```ts
import { Demo, VIDEO, VIDEO_HD, configure } from 'screenplay-kit';
import { orbit } from 'screenplay-kit/three';
```

**Copied in**: copy `src/` into the project's e2e folder (say
`tests/e2e/screenplay/`) and import from there. Playwright transpiles
TypeScript in the test tree, so nothing to build; the project owns the
copy and edits it freely. This is how the first project worked, and it
is fine: the kit is small. Note the copy's commit in the project so a
later kit change can be ported.

## The project's files

1. **`screenplay.config.mjs`** at the project root
   (`templates/screenplay.config.mjs`): where the scripts and the videos
   are, the voice, the `say` rules for the product's own words, the
   `undo` rules for the transcription check.
2. **The list of videos** (`templates/tutorials.ts`): one module the app
   and the spec both read (ids, groups, file names, lengths); titles and
   blurbs in the app's strings, so the cards in the app and on the video
   match.
3. **The spec** (`templates/demos.spec.ts`): skipped unless `DEMOS=1`,
   a 30-minute timeout, the layout viewport and dark scheme, `begin()` /
   `intro()` / `finish()` helpers, a test per video.
4. **A sales or promo spec** (`templates/promo.spec.ts`) when there is
   one: the same recorder at full HD, its own output folder, skipped
   unless `PROMO=1`.
5. **Fixtures**: the account the videos sign in with, the mocked answers
   (AI, payments), pictures drawn in a page and screenshotted.
6. **`package.json`**: `"voiceover": "screenplay-voiceover"` (or
   `node tests/e2e/screenplay/voiceover.js` for a copy); `.voice-cache`
   in `.gitignore`.
7. **Where the app serves the videos**: a static folder of `.mp4` and
   poster `.jpg`, same origin (no third-party player, nothing to add to
   a CSP), and the page that lists them.
8. **Tests**: every video and poster served; the card's length against
   the file.

## The app's side

- A development build exposes what the specs need to find things on
  screen: for a three.js scene, `window.three = { camera, controls, gl,
  scene }` with `camera` as a getter (a view change may swap cameras);
  for a store, a handle to read state (node positions, ids).
- Full screen falls back to an in-window view when `requestFullscreen`
  rejects (the overlay makes it reject).
- Controls the specs click have stable selectors (classes or data
  attributes, not text that i18n may change).
- Anything the videos must never show (a real key, a real email) is
  mocked; the fixtures use obviously fake values.

## The voice's pace

`voice.maxWordsPerSecond` in `screenplay.config.js` (default 3) is the
fastest a line may be spoken. The kit measures every clip as it is made
and remakes a faster one at a lower voice speed (`voice.settings.speed`
is where it starts, default 1); a line that is still too fast at the
slowest speed fails the take with the line named. Changing the ceiling
remakes the clips over it on their next use, which changes their
lengths: re-record the videos they are in.

## Documenting it in the project

Put a short section in the project's contributor notes: the commands,
where the videos and scripts live, that a user-facing change the videos
show re-records them, that the voice tooling sends only the scripted
lines to the voice service, and a link to this repository for the rules.
