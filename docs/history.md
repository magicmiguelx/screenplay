# History

Where the kit and its rules came from: the tutorial and sales videos of
Plenoview (`github.com/magicmiguelx/plenoview`, a browser app for drawing
multi-platform data architectures in 3D), recorded in October 2026. The
commits are in that repository; the kit was extracted from its
`tests/e2e/demo.ts`, `tests/e2e/demos.spec.ts`, `tests/e2e/promo.spec.ts`,
`scripts/voice.mjs` and `scripts/voiceover.mjs` at commit `4f81cdf`
(2026-10-11), made app-agnostic, and given a heartbeat for pages that
draw nothing between actions.

| When | What | What was learned |
| --- | --- | --- |
| 2026-10-07 | A recorder and the first script (work in progress) | Playwright's video blurs text: the DevTools screencast and ffmpeg instead. Headless Chromium draws no cursor: the overlay. Browser full screen crops the screencast: refuse it. |
| 2026-10-08 | Six tutorial videos offered after sign-in (U28) | Videos as specs skipped unless asked, with the app's own mocks; a title card standing in for an external payment page; the timed script (`.vtt`, `.md`) written with the video; the voice-over as a separate step (`speak`, re-record, `mix`) with the spoken lengths kept in `voice.json` so captions have room. |
| 2026-10-08 | Eighteen tutorials in four tracks, voiced as they record (U29) | The clip made before the caption shows, the wait cut out; a line's own spoken text, written for the ear; measured: the model takes no phoneme tags and respelling moves no stress, so the sentence decides ("Present the tour"); brand and acronym fixes for every line ("Plen-oh-view", "S-A-P", "statement of work"); `check` transcribes the clips with Scribe. The silences filled, the teasers dropped, real lengths on the cards. |
| 2026-10-08 | "Open AI" heard as "OpenAI"; the last line cut short | Say "the AI button"; hold the last frame until the last line is said. |
| 2026-10-09 | The sales video (G3), full HD | The same recorder at a higher device scale factor keeps every coordinate; a smooth orbit drawn frame by frame while the screencast is paused; the poster cut from the finished file. |
| 2026-10-09 | A quality check of every recording | Frame sheets, the shipped audio transcribed, the cards' moments measured against the voice: a second early at the start, up to two seconds late by the end, a flash of the editor at one end. |
| 2026-10-09 | The recorder keeps the voice on the picture | One timeline built from the frames (`videoTime`); a line spoken once two frames drawn after its fade are in (`painted()`); the screencast warmed up off camera; the closing card held to the end. All nineteen videos re-recorded: within half a second at both ends. |
| 2026-10-10 | Two tutorials re-recorded with clips heard as written | A `check` after every re-recording, not only the first. |
| 2026-10-11 | This repository | The kit extracted and made app-agnostic; the smoke test found that a still page sends no screencast frames (the heartbeat) and that init scripts do not run for `setContent()` (fail loudly when the overlay is missing). |

The numbers from the series, for scale: eighteen tutorials, 38 minutes,
236 spoken lines, recorded in about an hour and a half end to end with
the voice; the sales video two minutes. Lengths ran from 1:11 to 3:06.
