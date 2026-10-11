# Planning the videos for an app

How the kit is pointed at an app and comes back with a list of videos
and a roadmap for making them. The method is written for a person or an
agent (`.claude/skills/plan-videos` plans, `.claude/skills/make-videos`
delivers); the roadmap's format is `templates/video-roadmap.md`. It was
first used on Plenoview's own series (eighteen tutorials, a sales video
and a landing-page film), which is where the numbers below come from.

## 1. Survey, don't guess

The list comes from what the app says about itself and what its tests
prove, read in this order:

| Read | For |
| --- | --- |
| README, user guide, help pages | The features as the maker names them, in the order they are taught: the tutorials' order is usually already there. |
| Site copy, landing page, `<meta>` descriptions | The audience, the promise, the product's own words. A promo claims nothing these do not, and nothing the product has not measured. |
| Roadmap, changelog | What is built, half built, next. A feature about to change is a re-recording: later in the roadmap, or left out. |
| The e2e tests | Every feature with a passing test can be shown, and its test is the spec's skeleton: selectors, fixtures, mocks. No test, no video (a risk item, not a video item). |
| UI strings (i18n, menu labels) | The words the cards must use; titles that read badly aloud (a spoken form); brand words and acronyms for the `say` rules. |
| What a dev build exposes (`window.*` handles, data attributes) and what must never show (keys, emails, payments) | The driver's handles, and the mocks and fixtures every video shares. |

Nothing is run or recorded in the survey.

## 2. The list

**Tutorials**: one idea each (say in a sentence what the viewer can do
after watching), one to three minutes, in tracks watched in order. The
usual arc: get started → bring your data in → the advanced features →
present and share; use the product's own order where it has one. The
first video is always "what is it", the idea in a minute, and the landing
page should not use it as its promo (a tutorial explains; a promo sells).
Fifteen to twenty videos is a full series; five to seven is a first
track, which is what to plan first when the app is still moving. No
teasers: a feature with its own video is not previewed in another.

**Promos**, each with its audience and where it will be shown:

| Piece | Length | Shape |
| --- | --- | --- |
| The landing-page film | about 20 s | A hook (the problem, three seconds), the reveal, two beats of one line and one action, the offer held to the end. Fragments for the ear, six to nine words a line. |
| The sales piece | one to two minutes | The problem everyone recognises, the reveal, three or four beats, the offer. |
| A feature piece | 30 to 60 s | One headline feature for one audience, when the product has more than one. |

For every video: an id, its group, the file name, the idea, the beats
(one line each, the action beside it), the features it shows and the test
that proves each, the mocks and fixtures it needs, a target length, and
the words the voice will need rules for.

## 3. The roadmap

Phases in order, every item with what "done" looks like:

0. **Adopt the kit** (`docs/adopting.md`): config, the list module, the
   spec files, where the app serves the videos, the tests that check
   them. Skipped where the app has them.
1. **Fixtures and mocks** the videos share: the account, example data,
   AI and payment stand-ins, pictures drawn in a page.
2. **The tracks**, one video per item in watching order; a promo after
   the tutorials it borrows its beats from.
3. **Checks and shipping**: `voiceover check` on every line, the quality
   checks, the app's list and guide, the served-files test.

An item that needs something the app does not have (a mock, a stable
selector, a `window` handle) is marked blocked on it, in the app's terms,
so the app's own backlog can take it.

## 4. Estimates, from what was measured

Use the series' numbers (`docs/history.md`), and say so in the roadmap;
do not invent others:

- Eighteen tutorials, 38 minutes of video, 236 spoken lines, recorded
  with the voice in about an hour and a half end to end on a software
  renderer; a three-minute video takes five to ten minutes to record.
- Writing is the cost: a tutorial's spec is one to two hours of writing
  and two or three takes before the clicks land and the lines sit over
  the right screen; the voice check and the fixes are another half hour
  per video the first time, minutes after.
- A twenty-second promo is not a short tutorial: its lines are rewritten
  more times than a tutorial's (every word is paid for twice, in time and
  in attention), and it borrows every beat from a tutorial already made,
  so plan it after them.
- A recorder change re-records everything: the series is cheap to
  re-record (the hour and a half) next to a viewer noticing.

## 5. Delivering it

`docs/new-video-checklist.md` per video, in the roadmap's order; the
roadmap ticked as items are done with the date and the real length; what
was learned that is not app-specific goes to the playbook and the history
in the same change. The hand-over names each video, its length, the lines
`check` flagged and what was done, and what is next or blocked.
