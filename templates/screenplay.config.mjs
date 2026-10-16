// The project's video config, read by `screenplay-voiceover` (and imported
// by the specs for the same voice rules). Copy to the project root.

/** @type {import('screenplay-kit').ScreenplayConfig} */
export default {
  // Where each video's script (.vtt, .json, .md) and the durations file (voice.json) live.
  scripts: 'docs/demo-scripts',
  // Where a script's video is: a folder, or a function of the script's name.
  videos: name => (name.startsWith('promo-') ? `public/promo/${name.slice(6)}.mp4` : `public/guide/video/${name}.mp4`),
  voice: {
    // Set here, these win over ELEVENLABS_VOICE and ELEVENLABS_MODEL (used only when left out).
    voiceName: 'James - Professional British Male',
    // Or the voice by id, no lookup by name (ELEVENLABS_VOICE_ID overrides it).
    // voiceId: '…',
    model: 'eleven_multilingual_v2',
    // The speech-to-text model `voiceover check` transcribes with.
    // transcriber: 'scribe_v1',
    // Words the voice says wrongly as written, checked by transcribing its
    // clips (voiceover check): applied to every spoken text, the line's own
    // or the caption's, so scripts can be written plainly.
    say: [
      [/\bAcmeviews?\b/g, m => m.replace('Acmeview', 'Ack-me-view')],
      [/\bSAP\b/g, 'S-A-P'],
      [/\bSOWs?\b/g, m => (m.endsWith('s') ? 'statements of work' : 'statement of work')],
    ],
  },
  // For the transcription check: the respellings written back, and the transcriber's own spellings.
  undo: [
    [/ack-me-views?/g, m => m.replace('ack-me-view', 'acmeview')],
    [/\backme view\b/g, 'acmeview'],
    [/s-a-p/g, 'sap'],
    [/draw dot i o/g, 'drawio'], [/draw\.io/g, 'drawio'],
    [/open lineage/g, 'openlineage'],
    [/\bu r ls\b/g, 'urls'],
    [/\bthree d\b/g, '3d'],
    [/\blife cycle\b/g, 'lifecycle'],
    // "at acme dot example" is heard as "acme.example", and the dot goes with the punctuation.
    [/\bdot (com|example|io)\b/g, '$1'],
  ],
};
