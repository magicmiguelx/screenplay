# Writing for the ear

The caption is read; the voice is heard. They are two texts, and the
second has rules the first does not. Everything here was measured on
ElevenLabs `eleven_multilingual_v2` with the voice "James - Professional
British Male" (settings: stability 0.55, similarity 0.75, style 0.1, speaker
boost on) across 236 lines; another voice or model may differ, so check
(section 5) before trusting any of it.

## 1. Every line has a spoken text

```ts
await demo.say('Each platform is a layer: here SAP below, Microsoft Fabric above.', {
  voice: 'Each platform is a layer. Here, SAP is below, and Microsoft Fabric is above.',
});
```

Without `voice`, the caption is spoken as `speakable(caption)` (section
3). Write a `voice` whenever the caption would read badly aloud: a colon,
a list with no "and", a symbol, a key hint, a short caption that needs a
word more to be a sentence.

## 2. Pauses are punctuation

The voice honours commas, full stops and "…" (three dots: the recorder
turns the ellipsis character into them). A longer pause is
`<break time="0.4s" />`. A list is read best with a comma before each item
and "and" before the last: "Source, Ingest, Store, Process, Serve, and
Insight."

Two sentences beat a semicolon. "Today... and the Target: where the plan
says it should be." lands; the caption's "Today, and the Target." reads
fine but is flat aloud.

A written pause is heard, but it does not buy time against the speed
limit (section 5). Measured on 12 October 2026: "One step at a time,
with a caption for every step." took 4.2 s plain, 3.8 s with
`<break time="1.0s" />` after the comma and 3.9 s with "..." there; the
model's take of a line varies by a tenth from clip to clip, and the
pause came out of the words around it. A line that fails the ceiling at
the slowest speed wants fewer words, or a word with more syllables in
place of a short one: "the story you tell with the diagram" passed
(2.86 words a second) where "with it" failed at the slowest speed with
or without a pause (3.05, 3.15), and "say, in a few words, what it
should cover" passed where "say what it should cover" ran at 3.5.

## 3. Symbols become words (`speakable`)

| Written | Spoken |
| --- | --- |
| `→` | ", then " |
| `✨` | dropped |
| `(K)` (a key hint after a word) | dropped |
| `Ctrl+Shift+F` | "Control Shift F" |
| `Ctrl+Z` | "Control Z" |
| a bare `+` | "plus" ("with +," → "with plus,"; "C++" and "a+b" are left) |
| a bare `×` | "the cross"; between numbers "by" ("1920 × 1080") |
| `80%` | "80 percent" |
| `≥` | "at least " |
| `…` | "..." |

Anything else (a slash, a pipe, a hash) needs its own `voice`.

## 4. Pronunciation: place the word, don't respell it

Measured: the model reads "click Present" as the noun (PREZ-ent) however
the word is written. "pre-ZENT", "preSENT" and "pre-sent" moved nothing
(the louder syllable of each clip's word was found from Scribe's word
timings); it takes no SSML phoneme tags. What works is the sentence: a
verb before an object. "Present the tour", "Present it full screen".
The same applies to any word with two readings (record, object, project,
export as a noun): make the grammar decide. Punctuation is part of the
grammar: "Run the combats, live." was read as the verb (liv), the comma
having cut "live" loose as a command; "Run the combats live." is the
adverb (lyve), and so are "Run the fight live, on every screen" and
"Then run it live" (2026-10-13).

A transcript cannot tell two readings apart ("live" is "live" either
way), and neither can the word's length from Scribe's timings (0.18 s
and 0.20 s). The vowel can: `templates/vowel-formants.py` tracks the
first two formants through the word with Praat and prints them beside a
clip whose reading is certain ("Live combat", "I live here"). The
diphthong of "lyve" starts with F1 high and falling and F2 rising; the
short vowel of "liv" holds F1 low and F2 high. That is how the comma was
found, without ears.

What did work as respelling, for words the model does not know:

| Word | Heard as | Sent as |
| --- | --- | --- |
| Plenoview (a brand) | "plane of view" | "Plen-oh-view" |
| SAP | the word "sap" | "S-A-P" |
| SOW | "so" | "statement of work" (plural "statements of work") |
| Open AI (a button called "AI") | "OpenAI" | the line now says "the AI button" |
| CSV, URLs, MSK, PNG, SVG | run together | "C S V", "U R Ls", "M S K", "P N G", "S V G" |
| £20 | varies | "twenty pounds' worth" |
| 3D | fine | "3D" (heard as "three d" or "3d", both fine) |

Brand and acronym fixes go in the project's `say` rules
(`screenplay.config.mjs`, applied to every spoken text, the line's own or
the caption's) so scripts stay plainly written. A fix that changes a
line's meaning for the reader (SOW) is a `voice` rule, not a caption
change.

## 5. Check by listening with a machine

```sh
screenplay-voiceover check            # every clip
screenplay-voiceover check 08 promo   # by name
```

Each clip is transcribed with ElevenLabs Scribe and compared, word by
word after normalising (lower case, no punctuation, spelled-out letters
joined, number words as digits, with "five thousand, six hundred" and
the transcript's "5,600" both "5600", the `say` respellings written back
by the config's `undo` rules), with what was sent; lines with a word not
heard are listed with what was sent and what was heard. Listen to those.

False positives seen: the transcriber's own spellings ("life cycle" for
"lifecycle", "dialogue" for "dialog", "around" for "round", American
"armor" for a British "armour", "A DM's" joined as "ADM's"), a brand it
writes its own way whatever is sent ("plano view", "PlanoView": the owner
confirmed the clip says it right), and a web address said as "dot com"
and written "plenoview.com" (the dot goes with the punctuation). Add such
spellings to `undo` once they are known.

Two more kinds, from PF1e Campaigner's promos: a price is written as a
figure ("$2 a month" for "two dollars a month", an `undo` rule), and two
short words can run together in the voice ("Toggle Bull's Strength" was
heard as "Toggleball's strength"; "Switch on Bull's Strength" was heard
whole). An acronym said as letters can land as a word too ("D M's" as
"DMC" and "DM sighed", "C R" as "seer"): say the thing in full.

A line's pace is measured, not guessed: words a second over the clip's
length, against the project's ceiling (`maxWordsPerSecond`, default 3).
A short plain sentence is what the voice reads fastest, so a line that
fails the ceiling at the slowest speed wants a word fewer, or a longer
word for a short one (section 2: a written pause does not lengthen the
clip), not a faster caption. Of Plenoview's 293 lines, 288 fitted under
the ceiling as written (the slower speeds did it), and five needed
rewriting, each by a word or two.

## 6. Titles

A title card's spoken text is the title and its line joined ("Title. The
line under it."); a title that ends in punctuation is left as it is. A
title that reads badly aloud gets a spoken form in the spec: "dbt, Open
Lineage, and Excel"; "Share it, and export it"; "The AI prompt, and the C
S V import". The closing card's voice is "Next: " plus the next title's
spoken form.

## 7. Length

A line a viewer reads in five seconds is spoken in four to seven. The
caption stays up for whichever is longer, so a long `voice` on a short
caption holds the screen; split the line instead. Twenty words is a long
line; a card's blurb of twenty-five is the most that fits the card.

In a film of twenty seconds the lines are fragments: three to nine
words, one to three seconds ("Boxes and arrows. One platform at a time."
"Pick any system... and see everything it feeds." "Today..." "...and the
Target."), and the caption is the fragment as written, since nobody reads
a film. The ellipsis splits one thought over two pictures: the voice
pauses on it, and the second half is a line of its own, set over the
second picture.
