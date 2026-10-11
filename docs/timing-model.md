# The timing model

How a moment in the recording becomes a time in the video, and why the
voice lands where it does. The code is `src/timeline.ts` (pure,
unit-tested) and `src/recorder.ts`; the driver (`src/demo.ts`) uses them.

## Frames

The screencast delivers a JPEG whenever the page changed, with the
browser's timestamp (`wall`, seconds since the epoch, the same clock as
`Date.now()`). The recorder keeps each as a file and adds it to the
timeline with its `wall`. The timeline gives it a start in the video:

| The frame before it was… | This frame starts at |
| --- | --- |
| an ordinary screencast frame | `last.video + (wall − last.wall)`: the gap between them |
| the last frame before a cut (`pause()` at time `cutFrom`) | `last.video + max(1/30, cutFrom − last.wall)`: the still is kept as long as it lasted, then the picture jumps |
| a frame drawn by hand with `hold` | `last.video + last.hold` |
| nothing (the first frame) | 0 |

A frame drawn by hand (`addFrame(data, hold)`) is added while the
screencast is paused, with the moment it was drawn as its `wall` and its
own `hold`; a run of them is a smooth move whatever the renderer's rate,
and a single one held for seconds is a still (`still()`).

## Moments

`videoTime(wall)` places a moment (a line's start, its end, the end of the
recording) on those frames: the frame being shown at that moment (the
last frame whose `wall` is at or before it), as far into it as the moment
is, capped at the frame's own length. A moment inside a pause lands on
the cut, or, when frames are drawn by hand in the pause, on the first
frame drawn after it (an earlier version stamped every drawn frame with
the pause's start, so a line set in the pause landed after them all: the
voice came after the orbit). A moment before the first frame is 0.

The script's lines are logged with wall-clock moments as they happen
(`from`, `to`) and converted at `save()`, when every frame is known. The
clips are mixed at the converted starts. The video's length is
`videoTime(now)` at `save()`; a still screen sends no frames, so the last
frame is held to that length (plus a 0.6 s tail), and the mix pads the
picture if the last clip is longer still.

## When a line starts

Showing a caption is a CSS fade (0.3 s; a title card 0.45 s). The line is
logged, and its clip placed, when it is in the picture, not when the
overlay was told: `painted(now + FADE)` resolves once two frames timed at
or after `now + FADE` have arrived.

- One frame is not enough: a frame shows the page as it was when the
  frame *began*, which on a software renderer over a heavy scene is most
  of a second before its timestamp. The second frame timed after the
  moment was begun after the first was delivered, so what the first may
  have missed is in it.
- `FADE` is 1.0 s: the fade plus the half second a drawn frame was
  measured to lag the page.
- After 4 s without those frames it resolves anyway (the page is still and
  the heartbeat is off, or the screencast is paused). With the overlay's
  heartbeat on, a still page still sends frames and the wait is the
  margin only.

## The room a line has

| | |
| --- | --- |
| Reading time | 1200 ms + 330 ms a word (`readMs`) |
| Spoken time | the clip's length (ffprobe), from the cache, else the durations file |
| Breath | 400 ms after a spoken line before the next |
| `say()` | shows the caption for `max(readMs, ms given)`, then waits for the speech to end, then takes it down and waits 250 ms |
| `note()` / `clearNote()` | the caption stays while actions run; `clearNote()` waits for the speech first; the next `say()` or `note()` also waits |
| `card()` | shown for `ms` (default 4.5 s) and until spoken; `hold: true` leaves it up |
| `cardAcross()` | 60 % of `ms` (or the voice less 40 %) on camera, the cut, 0.9 s to settle, 40 % of `ms` on camera |
| `drawFrames()` / an orbit / `still()` | lasts at least the rest of the line being spoken plus 0.3 s |
| a line set while paused | logged after the fade (0.5 s), with no frame to wait for; placed on the first frame drawn after it (each drawn frame carries the moment it was drawn) |
| a cut while a line is spoken | on resume the line's remaining speech grows by the cut's length (`Recorder.onResume`), unless frames were drawn in the cut, which lasted at least the rest of the line |

## The drift that was fixed

The first recorder kept the script on the wall clock and subtracted the
pauses. Each cut took the paused span out of the script's clock but a
little more out of the frames (the frame after the cut starts where the
still before it ended, and the still is shorter than the span by the
frame's own lag), so by the end of a three-minute video the voice was up
to two seconds late. At the start it was a second early: lines were
logged when the overlay was told, not when the renderer had drawn them.
A frame sheet and the shipped audio transcribed found both; the fix was
the timeline above, `painted()`, and the warm-up discard. Re-recorded, the
voice was within half a second of its card at both ends of every video.
