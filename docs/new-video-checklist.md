# A new video: the checklist

For a project that already has the kit set up (`docs/adopting.md` if it
does not). Work down it; every line is a rule from `docs/playbook.md`.

## Before writing

- [ ] **One idea.** Say in a sentence what the viewer can do after
      watching. One to three minutes; a sales piece about two.
- [ ] **Where it goes.** Add it to the project's list of videos (the
      module the app and the spec share): id, group, file name, a
      placeholder length. Its title and blurb go in the app's strings;
      the opening card uses the same words.
- [ ] **What it shows is real.** The feature is built and its e2e test
      passes; the mocks it needs exist (AI answers, a payment stand-in).
      Nothing in the video may claim what the product's measurements
      don't support.
- [ ] **The outline:** the beats in order, one line each, the action next
      to each line. Cut anything that repeats another video; drop teasers
      for features with their own video.

## Writing the spec

- [ ] Opening card: the series' kicker ("Tutorial · 7 of 18"), the title,
      the blurb; a `voice` if the title reads badly aloud.
- [ ] Every line has a `voice` written for the ear (punctuation for
      pauses, "and" before the last item, verbs before "Present"-type
      words, acronyms as letters, numbers as words).
      `docs/writing-for-the-ear.md`.
- [ ] Nothing silent for more than a few seconds: a `note()` over an
      action, a line for the orbit.
- [ ] Slow or dull mechanics cut: `rec.pause()` … `rec.resume()` around
      loads and dialogs' plumbing; `cardAcross()` over a navigation.
- [ ] Smooth moves drawn by hand (`drawFrames`, the three.js `orbit`).
- [ ] Captions `top: true` where the bottom of the screen is what they
      describe; `spot()` on the element a line is about, and `spot(null)`
      after.
- [ ] A `poster()` at the video's best still.
- [ ] Closing card with `hold: true`: "Next: …" naming the next video, or
      the series' end.
- [ ] `demo.save()` to the served folder and the scripts folder, with the
      title and the spec's path.

## Recording

- [ ] Record it alone first, without the voice
      (`DEMOS=1 npx playwright test demos -g "<its name>"`): fix clicks
      that miss, dialogs that stay open, lines over the wrong screen.
- [ ] With the voice (`ELEVENLABS_API_KEY` set): the clips are made as it
      records and cached; look at the mix warnings.
- [ ] `screenplay-voiceover check <name>`: listen to every line it lists;
      reword, add a `say` rule, or accept a transcriber's spelling.
- [ ] Read the script table (`.md`): no Room shorter than Voice, no long
      silence, starts above 0:00.0. `docs/quality-check.md`.
- [ ] Watch it once at full size with the sound on.
- [ ] Put the real length on its card (from `demo.save()`'s return, or
      ffprobe).

## Shipping

- [ ] The video, its poster and its scripts committed in one commit named
      for the video.
- [ ] The app's list, the guide's section, the README's section updated;
      the test that checks every video is served passes.
- [ ] If the recorder or the overlay changed: re-record every video, not
      just this one.
