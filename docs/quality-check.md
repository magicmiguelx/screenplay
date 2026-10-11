# Checking a recording

What to look at before a video ships, and how. These are the checks that
found the problems the playbook's rules came from; run them on every new
video and on every video after a recorder change.

## 1. The script table

`demo.save()` writes `<name>.md` beside the video: one row per line with
its start, its room on screen, the voice's length and the caption. Read
it:

- A **Room** shorter than **Voice** means the line was cut off (the next
  line waited less than the speech; it should never happen, the driver
  waits, so it points at a `rec.pause()` around a `say()`).
- A long **Room** with a short **Voice** (14 s against 4 s) is a silence
  to fill or a wait to cut.
- A **Start** of 0:00.0 on a line that is not the first means the line was
  logged before the first frame: the overlay was not drawn (is it
  installed? was the page loaded with `goto`?).
- The mix prints a warning for a clip that runs more than 50 ms into the
  next line.

## 2. Frame sheets

One frame a second, tiled, for the whole video: cuts, flashes (an editor
frame between two cards), a caption over a busy screen, a cursor parked
over what it points at, all show at a glance.

```sh
ffmpeg -i public/guide/video/01-what-is-it.mp4 -vf "fps=1,scale=320:-1,tile=10x12" -frames:v 1 sheet-01.png
```

A longer video needs more tiles (`tile=10x20`) or a second sheet
(`-ss 120`).

## 3. The audio, transcribed

The clips were checked before the mix (`voiceover check`); the shipped
audio is what the viewer hears. Extract it and transcribe it (ElevenLabs
Scribe, or any speech-to-text), then diff against the `.vtt`:

```sh
ffmpeg -i video.mp4 -vn -c:a libmp3lame -q:a 4 audio.mp3
```

A word heard wrongly here that the clip check passed is a mix problem (two
clips overlapping, a clip at the wrong time).

## 4. The voice against the picture

The measurement that found the drift. For each title card, the moment it
is first fully in the picture against the moment its line starts:

1. The card's moment: the first frame where the card is up. From a frame
   sheet at 10 frames a second around the card's expected time
   (`-ss <start − 2> -t 4 -vf fps=10`), or by scene detection:
   `ffmpeg -i video.mp4 -vf "select='gt(scene,0.4)',showinfo" -f null -`
   prints the time of each cut, and a card fading in is one.
2. The voice's moment: the line's `start` in the `.json`, or, from the
   audio, the first non-silent moment after the previous line
   (`ffmpeg -i audio.mp3 -af silencedetect=n=-35dB:d=0.3 -f null -`).

Check the first card and the last of every video: the drift grew along the
video, so the ends show it first. The target after the fix was half a
second; a second is a viewer noticing.

## 5. Watch the one you changed

Nothing above replaces watching the video once at full size, with the
sound on, as a viewer: the pace, a line that says what the screen already
shows, a caption that covers what it describes (move it `top: true`), a
drag that looks like a mistake.

## 6. What the project's tests can check

- Every video and poster the app lists is served (a request for each
  returns 200 and a video type).
- The length on each card matches the file (ffprobe in a unit test, or
  the length `demo.save()` returned written into the list).
- The scripts' `.json` lines are in order and never overlap.
