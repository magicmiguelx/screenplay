# Screenplay

Scripted, narrated product videos recorded from the app itself, and the
playbook of what was learned making them.

A video here is a Playwright spec: it drives the app the way a person
would, with a cursor, click rings, captions and title cards drawn over
the page, and says each line in an AI voice that stays on the picture.
Nothing is edited afterwards; a change to the product is a re-recording,
and a re-recording is one command. The approach was built for the
tutorial series and sales video of [Plenoview](https://www.plenoview.com)
(nineteen videos, October 2026) and is here so the next project, and the
next video, start from what that one learned rather than from scratch.

```
spec (the screenplay)  ──►  Demo (driver)  ──►  overlay in the page: cursor, captions, cards
                              │                       │
                              │                  DevTools screencast (JPEG frames, browser-timed)
                              │                       │
                        voice clips  ──►  Recorder: one timeline from the frames  ──►  ffmpeg (H.264)
                        (ElevenLabs, cached)                                            + the voice mixed at the frames' times
                                                                                        + the script: .vtt, .json, .md
```

## What is in here

| | |
| --- | --- |
| `docs/playbook.md` | **Start here.** The rules, each with the reason it exists. |
| `docs/new-video-checklist.md` | The short form to work through for a new video. |
| `docs/writing-for-the-ear.md` | How a line's spoken text differs from its caption; what the voice model does and does not do (measured). |
| `docs/timing-model.md` | How a moment in the recording becomes a time in the video, and why the voice lands where it does. |
| `docs/quality-check.md` | Frame sheets, transcription, and measuring the voice against the picture. |
| `docs/adopting.md` | Setting a project up: needs, files, the app's side. |
| `docs/planning.md` | Pointing the kit at an app: how the list of tutorials and promos is found, and the roadmap for making them (`/plan-videos` writes it, `/make-videos` delivers it). |
| `docs/history.md` | Where each rule came from, with dates. |
| `src/` | The kit: `Demo` (the driver), `Recorder` and `Timeline`, `Subjects` (which line each measured subject belongs to), the `overlay`, the voice (`configure`, `clip`, `mix`, `speakable`), the script writer, a three.js `orbit`, and the `screenplay-voiceover` CLI. |
| `templates/` | A project's config, its video list, a tutorials spec, a promo spec, a video roadmap to copy and fill in, the card check (`check-cards.mjs`: each video's first and last card measured against its voice) and the vowel check (`vowel-formants.py`: which of two readings the voice gave a word, measured on the vowel). |
| `examples/` | Five of the Plenoview specs, as recorded, with notes on what to look at: a tutorial, the three promo cuts from one spec (two minutes for outbound, a minute for the hero, twenty seconds for social), and the film at 9:16 for a phone. |
| `.claude/skills/` | For an agent: `plan-videos` surveys an app and writes its video roadmap; `make-videos` delivers it. |
| `tests/` | Unit tests of the timeline, the subjects, caption placement, the voice text rules, the script writer and the CLI; a smoke recording of a small page end to end. |

## Quick start

A project that already uses the kit: read `docs/new-video-checklist.md`,
add a test to its demos spec, record it alone, then with the voice, then
check it.

```sh
DEMOS=1 npx playwright test demos -g " 7 · "      # record one video (no key: captions timed by voice.json or reading time)
ELEVENLABS_API_KEY=… DEMOS=1 npx playwright test demos -g " 7 · "   # voiced as it records, the clips mixed in
npx screenplay-voiceover check 07               # every clip transcribed and compared with what it should say
npx screenplay-voiceover cover                  # every caption's place and cover, the lines over 50% listed (no key needed)
npx screenplay-voiceover seen                   # how much of each line's subject was in the picture, the lines under 90% listed (no key needed)
```

A new project, from nothing: `/plan-videos <path to the app>` surveys it and
writes `docs/video-roadmap.md` there (the tutorials in tracks, the promos,
the fixtures they need, the order to make them: `docs/planning.md`);
`/make-videos` works the roadmap. Setting the project up by hand: `docs/adopting.md`. In short, `npm install -D
github:magicmiguelx/screenplay#v0.2.0` (a tag, so the videos change only when the
project moves it; or copy `src/` into the e2e tree),
copy `templates/screenplay.config.mjs` to the project root and
`templates/demos.spec.ts` beside the e2e tests, and write the first
video.

```ts
import { Demo, VIDEO, configure } from 'screenplay-kit';

test.use({ viewport: VIDEO, colorScheme: 'dark' });
configure({ say: [[/\bSAP\b/g, 'S-A-P']] });

test('1 · what is it', async ({ page }) => {
  await Demo.prepare(page, { brand: 'Acme · the tagline' });   // before the first navigation
  await page.goto('/');
  const demo = new Demo(page, { durationsFile: 'docs/demo-scripts/voice.json' });
  await demo.start();
  await demo.card('Tutorial · 1 of 4', 'What is it?', 'The idea in a minute.');
  await demo.say('Click any item to read its properties.', { keep: true, voice: 'Click any item, to read its properties on the right.' });
  await demo.click(page.locator('#item'));
  await demo.spot(page.locator('#properties'));
  await demo.clearNote();
  await demo.card('Next', 'Getting started', 'Open an example and look around.', 3000, 'Next: Getting started.', { hold: true });
  await demo.save('public/guide/video/01-what-is-it.mp4', 'docs/demo-scripts/01-what-is-it', { title: '1 · What is it?', spec: 'tests/e2e/demos.spec.ts' });
});
```

## Needs

Node 20+, Playwright with Chromium, ffmpeg with libx264 and ffprobe on
the PATH. The voice is ElevenLabs on `ELEVENLABS_API_KEY` (real calls,
billed; never in CI). A WebGL app in headless Chromium wants the software
renderer flags (`--use-gl=angle --use-angle=swiftshader
--enable-unsafe-swiftshader`).

## Developing the kit

```sh
npm install
npm run typecheck
npm run test:unit        # the timeline, the voice text rules, the script writer
npm run test:smoke       # records tests/out/smoke.mp4 from a small page: Chromium + ffmpeg, about a minute
```

## License

MIT. Copyright (c) 2026 Vibing Legends Ltd.
