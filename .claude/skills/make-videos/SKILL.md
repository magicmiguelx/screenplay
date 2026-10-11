---
name: make-videos
description: Deliver a video roadmap made by /plan-videos: adopt the kit in the app if needed, build the fixtures, then write, record, check and ship each video in the roadmap's order, updating the roadmap as items are done. Use when asked to make, record or deliver the planned videos, or one of them.
---

# Deliver a video roadmap

The roadmap is `docs/video-roadmap.md` in the app repository (or the file
the person names). Work its items in order, or the one item asked for.
Read first: `docs/playbook.md`, `docs/new-video-checklist.md`,
`docs/writing-for-the-ear.md` before writing any line, `docs/quality-check.md`
before calling a recording done. The rules in the kit's `CLAUDE.md` are not
negotiable.

## Per phase

- **Adopt** (phase 0): `docs/adopting.md`. Install the kit or copy `src/`,
  the config from `templates/`, the list module, the specs. Record the
  smoke test of the kit once in the app's environment (Chromium, ffmpeg)
  before any video.
- **Fixtures** (phase 1): build them as the app's tests build theirs; a
  picture is drawn in a page and screenshotted, never a binary in the
  repository; nothing real (keys, emails, payments).
- **Each video** (phase 2): work down `docs/new-video-checklist.md`.
  Write the spec from the roadmap's beats; record it alone first, then
  with the voice; `screenplay-voiceover check` and listen; read the
  script table; put the real length on its card; one commit named for
  the video with the video, its poster and its scripts.
- **Ship** (phase 3): the app's list, guide and README; the served-files
  test; the roadmap's items ticked with an "as recorded" note (length,
  date, what was learned).

## Keep the roadmap and the kit current

- Tick each item in the roadmap when it is done, with the date and the
  real length; add items the work uncovers (a missing mock, a selector to
  stabilise) in the phase they belong to.
- Anything learned that is not app-specific (a word the voice mishears,
  a timing problem, a headless quirk) goes to this kit: the playbook
  with its reason, `docs/history.md` with the date, in the same change as
  the fix. Say in the hand-over which rules were added.

## Hand-over

For each video made: its path, length, the lines flagged by `check` and
what was done about them, and the frame sheet looked at. For the roadmap:
what is done, what is next, what is blocked and on what.
