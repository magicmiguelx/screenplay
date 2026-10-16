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
npm install -D github:magicmiguelx/screenplay#v0.2.0
```

Pin a tag (the releases are tagged `vX.Y.Z`): without one the project
follows `main`, and a recorder change there changes every video on the
next install, when "a recorder change re-records all of them" should be a
choice. Move the pin on purpose, read `docs/history.md` for what changed,
and re-record when the recorder did.

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
slowest speed fails the take with the line named (the take runs on and
`save()` lists every such line at once). Changing the ceiling
remakes the clips over it on their next use, which changes their
lengths: re-record the videos they are in.

## The voice and its clips

`voice.voiceName` (default "James - Professional British Male", the first
series' voice) is looked up in the account (any case), then in the
voice library, where it is added to the account under its own name; a
name found in neither fails with the near names in both. `voice.voiceId`
(or `ELEVENLABS_VOICE_ID`) names the voice by id and skips the lookup.
`voice.transcriber` is the speech-to-text model `check` uses (default
`scribe_v1`). A value set in the config wins over `ELEVENLABS_VOICE` and
`ELEVENLABS_MODEL`, which apply only when it is left out.

A clip is cached under a hash of the voice, the model, what is sent and
the voice settings. Settings left at the defaults add nothing to the
hash, so a project on the defaults keeps its cache; a change to
`voice.settings` (stability, style, the starting speed) makes new clips
on their next use, billed, with new lengths: re-record the videos. (Until
October 2026 the settings were not in the hash and a change to them got
the old clips; a project with its own settings remakes its clips once.)

## Where captions sit

Nothing to configure: every caption is measured at the bottom and the
top of the frame and drawn where it covers the least of the page's own
content, and it moves off the element the line then clicks or
spotlights. When both are busy (over `coverNote`, or `maxCover` when
lower) a clearly emptier corner is taken, narrower; `new Demo(page, {
corners: false })` keeps captions centred, which an app drawn on a
full-frame canvas (a 3D scene) wants: the canvas reads as content
everywhere, so a corner would win by covering a side panel. A line can insist with `top: true` or `bottom: true` (the
phone layout wants `top`). The script's "Over" column records each
line's position and cover; `new Demo(page, { maxCover: 0.6 })` fails a
take on a line over it, `coverNote` sets the level the log lists.

## What a line is about is in the picture

Also nothing to configure for the measuring: every line's subject is
measured in the picture while it is up (the elements it names with
`say(text, { about: locator })`, the spotlit element, and the element its
first action works on, before the action scrolls to it) and written to
the script's "Seen" column. `new Demo(page, { minInView: 0.9 })` fails a
take on a line whose subject is less in view than that; `inViewNote`
(default 0.95) sets the level the log lists. A line named with `about`
has its subject brought into the picture before it is said; `about:
false` marks a line about nothing on the page. For a second page shown
as a picture card, `bringIntoView(locator)` and `inView(locator)` work on
any page.

## Documenting it in the project

Put a short section in the project's contributor notes: the commands,
where the videos and scripts live, that a user-facing change the videos
show re-records them, that the voice tooling sends only the scripted
lines to the voice service, and a link to this repository for the rules.
