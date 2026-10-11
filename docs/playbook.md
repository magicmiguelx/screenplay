# The playbook

What was learned making nineteen narrated product videos (eighteen
tutorials and a sales video) from a browser app, recorded by Playwright
with an AI voice, over October 2026. Each rule below was paid for: the
reason is given with it, and `docs/history.md` has the dates. Read this
before writing a new video; `docs/new-video-checklist.md` is the short
form to work through while you do.

## 1. The shape of a video

- **A video is a spec.** It drives the app the way a person would (a
  cursor glides to each control, clicks ring, fields are typed into a key
  at a time) and says what it shows as captions and title cards. The spec
  is the screenplay: the actions and the lines, in order. Nothing is
  edited afterwards; a change is a re-recording.
- **Skipped unless asked.** The video specs live with the e2e tests but
  are not tests: `test.skip(!process.env.DEMOS)` (and `PROMO` for the
  sales video), with a long timeout (30 minutes each: a three-minute video
  takes five to ten to record on a software renderer, more with the
  voice). CI never records and never has the voice key.
- **One video, one idea, one to three minutes.** The tutorial series: an
  opening card (its number of the series, title, and the same blurb the
  app's own card shows), the body, a closing card ("Next: …" or "That's
  the tour"). The sales video: about two minutes, a story arc (the problem
  everyone recognises, the reveal, three or four beats, the offer).
- **Tracks, in order.** Eighteen videos were grouped in four tracks (get
  started, bring your data in, the AI features, present and share),
  watched in order: a video's closing card names the next one. The list
  lives in one module the app and the spec both read, so the title cards
  and the app's cards never disagree.
- **Real lengths on the cards.** The first version guessed each video's
  length on its card; after recording, read the length the script reports
  (`demo.save()` returns it; `cardLength()` formats it) and put the real
  one in the list. A test can check the card against the file.
- **Fill the silences.** The first six videos had long silent stretches
  (an orbit, five systems added the same way). The remake gave each its
  line ("Search, click, name, and drag. The dbt models go in Process…").
  The pauses that remain are where the screen is busy (sliders, drags,
  typing), and those are short.
- **No teasers for what has its own video.** When a feature got a video
  of its own, the mentions of it in earlier videos came out.
- **Claim only what is measured.** The sales video makes AI a supporting
  beat and claims no accuracy; the product's evals say what can be
  claimed. A video outlives the number it quotes.
- **A film of twenty seconds is not a short tutorial.** The landing
  page's film (the second Plenoview promo) is the sales arc cut to its
  bones: a hook (the problem, three seconds), the reveal, two beats of
  one line and one moving picture each, the offer held to the end; five
  lines of three to nine words, said in one to three seconds. The voice
  sets the pace and nothing waits for a caption to be read. The hook is
  in the first frame (the picture goes up before `start()`), every
  mechanic is off camera, and every frame is drawn by hand (next
  section): a film has no room for the screencast's waits. Nothing is
  clicked on camera, so the cursor is parked in a corner for the whole
  film, and parked again after every off-camera click, which moves it
  (two takes had it in the closing card's title). A tutorial
  explains; a film sells; the landing page gets the film.
- **A video for a phone is a layout, not a new recorder.** The page is
  laid out at the phone's size (`layout`) and drawn at full HD portrait
  (`output` with the device scale factor), the overlay is sized for it
  (`css`: smaller type, a caption nearly the width of the screen, a card
  whose title fits), and the captions go to the top, clear of what an
  app puts at the bottom of a phone screen. The phone tutorial and the
  film's 9:16 cut were made that way (`examples/plenoview-promo-vertical.spec.ts`).
- **One spec, three cuts.** The beats are functions, so a two-minute
  sales piece, a one-minute hero cut and a twenty-second social film
  came from the same spec file in a day (`examples/plenoview-promo*.spec.ts`),
  each written to its own length: the hero cut is the whole arc with
  one line per beat, the film is the arc cut to its bones. A line trimmed
  is a second saved, and the first take of the minute ran seventy-five:
  write the cut, record it, read the script table, trim the lines whose
  Voice is long for their picture, record again.
- **Film a result in the view it reads best in, not the one it opens
  in.** The AI draft applied as a new diagram opens in the Front view;
  the minute cut turns it to 3D off camera before it drifts. A caption
  over the thing a line is about goes to the top (the timeline, a review
  table).

## 2. Recording

- **The DevTools screencast, not Playwright's video.** Playwright's video
  is a 1 Mbit/s VP8 that blurs a panel's text. `Page.startScreencast`
  gives JPEG frames (quality 92) with the browser's own timestamps; ffmpeg
  encodes them (libx264, crf 25, preset slow, tune stillimage, yuv420p,
  faststart) at 30 frames a second through the concat demuxer, each frame
  with its own duration. The last file is listed twice: the demuxer
  honours the last entry's duration only then.
- **Headless Chromium draws no cursor,** so the page gets an overlay
  (`src/overlay.ts`): an SVG pointer moved by a CSS transition (smooth
  even when the page itself renders at a few frames a second), a ring on
  each click, a caption at the bottom (or top, when the bottom is busy),
  a title card, a picture card, a spotlight that dims everything but one
  element. It is installed by `page.addInitScript`, so it is in every
  document the page loads. Init scripts run on a navigation, not on
  `page.setContent()`: load the app with `page.goto()`.
- **Refuse browser full screen.** A real `requestFullscreen` in headless
  Chromium resizes the screencast's surface and the frames come out
  cropped and zoomed. The overlay makes it reject; an app that falls back
  to an in-window full-screen view looks the same at the recording's
  window size.
- **A still page sends no frames.** A WebGL scene redraws all the time, a
  plain page does not, and the screencast only sends what changed. The
  overlay keeps a heartbeat (an invisible 2-pixel dot stepped 12 times a
  second), so frames keep coming and the recorder can tell when a caption
  is in the picture. An app whose scene renders continuously can turn it
  off.
- **The layout is one size.** 1440 × 810 (16:9, wide enough that both side
  panels stay pinned). Full HD is the same layout drawn at a higher device
  scale factor (1920 / 1440), so every coordinate in every spec stays
  valid and the screencast comes out at 1920 × 1080.
- **Cut what the viewer need not sit through.** `rec.pause()` …
  `rec.resume()` around a page load, a slow redraw, the mechanics of a
  dialog whose result is what matters, a wait on a mocked API. The video
  jumps; the timeline keeps the still before the cut as long as it lasted.
  `cardAcross()` holds a title card across a navigation (a payment page
  and back).
- **Smooth moves are drawn by hand.** A software renderer screencasts a
  camera orbit at a few jerky frames a second. `drawFrames()` pauses the
  screencast, puts the page at each step of the move, screenshots it, and
  keeps the screenshot as a frame of 1 / 30 s: the move is smooth however
  long drawing it took. `src/three.ts` has an orbit for a three.js scene.
- **A heavy scene is drawn by hand too, stills included.** A lit scene
  (a highlighted path, shadows) screencasts at under a frame a second in
  software, so every beat on the screencast stretches: a caption waits
  up to four seconds for its two frames, a click's result arrives when
  it arrives, and the first take of a twenty-second film ran thirty-nine.
  Set the line while the screencast is paused (it is logged at once, the
  fade waited out), then draw the frames under it (`still()` for a card,
  a picture or a caption over a still picture; `drawFrames()` or an
  orbit for a move): the line is spoken as those frames start. A drawn
  frame carries the moment it was drawn, which is what places the line
  (an earlier version stamped every drawn frame with the pause's start,
  and a line set in the pause landed after the whole orbit). While
  paused, `say()` and `card()` set the line and return: no wall-clock
  wait, no taking it down (there is no frame to show either); the frames
  drawn next last as long as the line needs. And a clip made for a line
  while paused leaves the pause alone (the first voiced take resumed
  after every uncached clip, and each beat got a second of live frames
  before its still). An app animation the screencast cannot keep up with
  (a timeline played) is shown as before and after, each drawn: a cut is
  what the screencast would have shown anyway.
- **The screencast restarts after a navigation.** Coming back from an
  external page can end it; the recorder starts it again on
  `framenavigated`.
- **Don't touch the app's source while it records.** The dev server's
  hot reload is a navigation: the page reloads, the scene and its
  handles are gone, and the take dies with a baffling error (the film's
  first take, twenty frames into the orbit, after an edit to the app's
  strings; the failure screenshot showed the default diagram, which was
  the clue). Edit the docs, not the app, while a recording runs, or
  record from a second checkout.
- **The cost of a drawn frame, measured once.** In a four-core container
  with no GPU, a full-HD screenshot of a lit three.js scene takes 2.5 to
  3.7 s (40 frames in 115 s, measured twice); at the layout size about
  half that. A twenty-second film drawn at 20 frames a second is about
  250 screenshots, ten to fifteen minutes; budget a take accordingly, and
  draw stills as one frame held (`still()`), never as a run of identical
  screenshots. "THREE.WebGLRenderer: Context Lost." in the console during
  a take is the app's own thumbnail canvas being unmounted (React Three
  Fiber forces a loss on unmount), not the scene's context: the scene
  handle survives it.
- **Warm up off camera.** The screencast's first frames can show the
  page as it was before recording started. `demo.start()` waits for frames
  from the running stream, then discards them: the video starts with the
  opening card, not two seconds of the editor.
- **A take that hangs is run again with `DEBUG=pw:api` and a
  `--timeout` cap,** and then with a small diagnostic spec that logs the
  page's console and state every few seconds. The phone tutorial hung
  twice in a `waitForFunction` for the shared view; the log blamed the
  navigation, the diagnostic showed the landing page: the spec had read
  the share link's input before the app had filled it in, and sent the
  phone to a URL made of the placeholder "Preparing the link…" (a first
  take had won the race). Read a value the app computes only once it is
  what you expect (`expect(input).toHaveValue(/#\/view/)`), as the app's
  own test did. And stop a stuck run by its process id: `pkill -f` with
  a pattern that matches your own shell's command line kills the shell
  that typed it.
- **Record one video by its title, unanchored.** Playwright's `-g`
  matches the file path and the title together, so `-g "^7 ·"` finds
  nothing and `-g " 7 · "` finds the video (a kit README said the first
  for a day).
- **Typing behind a live scene is a second a key.** A dialog over a
  scene that renders on behind it (the account setup over the editor)
  made every keystroke take a second in software: thirty-two characters
  cost twenty-five seconds of video. Type off camera (`fill()` in a cut)
  and show the field full, unless the typing is the point and short.
- **Select lists never draw.** Headless Chromium does not render an open
  `<select>`: `choose()` rings the control and sets the value at once.
  Range inputs are dragged in steps and then `fill()`ed so the value lands
  exactly (the thumb's pixels round). Typing is `pressSequentially` with a
  40 ms delay. The browser's own `prompt()` / `confirm()` are answered
  with `page.on('dialog')` before they appear.
- **Click moving things once they stop.** After a view change the camera
  glides for a moment; `clickSettled()` asks where the target is until it
  answers the same place twice. Drop points for a drag go where nothing
  will later appear (a slot a new node would take would be covered, and
  the next drag would pick up the wrong one).
- **Pictures come from the page, not the repository.** A "whiteboard
  photo" was an SVG drawn in a second page and screenshotted, so the demo
  needed no binary in the repository and could be redrawn.
- **No real services.** AI calls go to a route mock with canned answers
  (as SSE when the app streams); payments to a stand-in Checkout address
  that answers 204, with a title card standing in for the external page;
  the account to a mocked session. Delays in the mock give the viewer a
  believable wait, cut when it is long.
- **The poster is a frame.** Each video gets a still for `<video poster>`
  from `demo.poster()` at a good moment; the sales video takes its poster
  from the finished file with `ffmpeg -ss` instead (a screenshot of a lit,
  heavy scene is slow and would land in the recording).

## 3. Timing: the voice stays on the picture

The one lesson that cost the most. The full model is in
`docs/timing-model.md`; the rules:

- **One timeline, built from the frames.** The first recorder placed the
  script's lines on the wall clock minus the pauses; every cut moved the
  voice a little later than the picture, up to two seconds by the end of a
  three-minute video. Now each frame starts where the one before it
  ended, a cut keeps the still before it as long as it lasted, a drawn
  frame lasts what it was given, and a line's time is looked up on those
  frames (`Timeline.videoTime`). The clips are mixed in at those times.
- **A line is spoken once it is in the picture.** Logging a line when the
  overlay was told to show it put the voice a second early: the software
  renderer had not drawn it. `painted()` waits for two frames timed after
  the fade (a frame shows the page as it was when it began, up to a frame
  earlier than its timestamp; the second frame timed after the fade was
  begun after the first was drawn, so the fade is in it). The margin is
  the fade plus the half second a drawn frame can lag a heavy scene.
- **Hold the closing card to the end.** Taking it down half a second
  before the end made one video end on a flash of the editor.
  `card(…, { hold: true })`.
- **The last line is never cut short.** A still screen sends no frames,
  so the last frame is held until the recording ends, and the mix pads the
  picture (`tpad`) if the last clip outlasts it.
- **Room for every line.** A caption stays up for the longer of its
  reading time (1.2 s + 0.33 s a word) and its spoken length plus a 0.4 s
  breath, and the next line waits for it. Spoken lengths come from the
  clips as they are made, and are kept in `voice.json` so a re-recording
  without the key keeps the same room. The mix warns when a clip runs more
  than 50 ms into the next line.
- **The clip is made before the caption shows,** with the screencast
  paused, so the wait is never in the video; clips are cached by a hash of
  the voice, the model and the text sent, so a re-recording pays only for
  changed lines.
- **A drawn move gives the voice room.** An orbit, and a drawn still,
  lasts at least as long as what is left of the line being spoken.
- **A cut gives a spoken line its length back.** The wall clock runs on
  while the picture stops, so a cut during a line (a page load behind a
  kept caption) took the cut's length out of the line's room: the
  caption came down, and the next line started, before the voice was
  done (two lines of the account tutorial, caught by the script table's
  Room against Voice). Now the driver extends the line by the cut on
  resume, unless frames were drawn in the cut, which carried the line
  already. Still: say a line in full before a cut when you can; the
  picture after the cut is a new thought.

## 4. Writing for the ear

The full rules and the measurements are in
`docs/writing-for-the-ear.md`.

- **The caption and the spoken text are two texts.** The caption is read;
  the line's `voice` is heard. Punctuation makes the pauses (commas, full
  stops, "…", `<break time="0.4s" />`).
- **Put a word where the sentence decides its pronunciation.** The voice
  model read "click Present" as the noun (PREZ-ent) whatever respelling
  was tried ("pre-ZENT" moved nothing; it takes no phoneme tags). "Present
  the tour" is a verb and comes out right.
- **Fix brand words and acronyms once, for every line** (`say` rules):
  "Plenoview" was heard as "plane of view" and is sent as "Plen-oh-view";
  "SAP" as a word, sent "S-A-P"; "SOW" as "so", sent "statement of work";
  "Open AI" was heard as "OpenAI" and the line now says "the AI button".
  Acronyms are spaced letters ("C S V", "U R Ls", "M S K"); numbers and
  currency are words ("twenty pounds' worth", not "£20").
- **Symbols become words automatically** (`speakable()`): "→" is "then",
  "Ctrl+Z" is "Control Z", "+" is "plus", "%" is "percent", key hints like
  "(K)" are dropped.
- **Titles that read badly aloud get a spoken form** ("dbt, Open Lineage,
  and Excel"; "The AI prompt, and the C S V import").
- **Check by listening with a machine.** `voiceover check` transcribes
  every clip (ElevenLabs Scribe) and lists the words not heard as written.
  Its own spellings ("life cycle", "dialogue", "plano view") are not
  errors; a brand it writes wrongly however it is spelled is noted and
  left.

## 5. Checking a recording

`docs/quality-check.md` has the commands. In short: frame sheets of every
video (a contact sheet of one frame a second) to see cuts, flashes and
captions over busy screens; the shipped audio transcribed to catch a
mispronounced word that survived; the moment each card is first in the
picture measured against the moment its voice starts, at both ends of
every video (the fix above brought it within half a second). After a
recorder change, re-record everything: the series is 38 minutes and the
check is cheap next to a viewer noticing.

## 6. Housekeeping

- `.voice-cache/` is ignored; the scripts (`.vtt`, `.json`, `.md`) are
  committed beside the docs, for the owner; the videos and posters are
  committed where the app serves them (a same-origin file, no third-party
  player, no script in the guide page).
- One commit per re-recorded video, named for it, keeps the history
  readable and a bad take easy to revert.
- A user-facing change the videos show re-records them. Say so in the
  project's contributor notes next to the feature, not only here.
- The voice tooling sends only the scripted lines to the voice service,
  and only its own clips back for the check: never app data, never a
  user's. Put that in the project's security notes when it has them.
