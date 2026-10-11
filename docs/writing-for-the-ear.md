# Writing for the ear

The caption is read; the voice is heard. They are two texts, and the
second has rules the first does not. Everything here was measured on
ElevenLabs `eleven_multilingual_v2` with the voice "James - Professional
Male" (settings: stability 0.55, similarity 0.75, style 0.1, speaker
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

## 3. Symbols become words (`speakable`)

| Written | Spoken |
| --- | --- |
| `→` | ", then " |
| `✨` | dropped |
| `(K)` (a key hint after a word) | dropped |
| `Ctrl+Shift+F` | "Control Shift F" |
| `Ctrl+Z` | "Control Z" |
| a bare `+` | "plus" ("with +," → "with plus,") |
| `with ×` | "with the cross" |
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
export as a noun): make the grammar decide.

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
joined, number words as digits, the `say` respellings written back by the
config's `undo` rules), with what was sent; lines with a word not heard are
listed with what was sent and what was heard. Listen to those.

False positives seen: the transcriber's own spellings ("life cycle" for
"lifecycle", "dialogue" for "dialog", "around" for "round") and a brand it
writes its own way whatever is sent ("plano view": the owner confirmed
the clip says it right). Add such spellings to `undo` once they are known.

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
