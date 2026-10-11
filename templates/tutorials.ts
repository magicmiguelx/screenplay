// The list of videos, read by the app (its tutorials screen or guide) and
// by the spec that records them (for the cards' numbering and the "Next"
// card). One place, so the two never disagree. Titles and blurbs live in
// the app's strings as `tutorials.<id>.title` / `.blurb`.

export type TutorialId = 'overview' | 'start' | 'edit' | 'share';
export type TutorialGroup = 'start' | 'work' | 'share';

export interface Tutorial {
  /** The file's name in the served folder, without the extension (.mp4 the video, .jpg its poster). */
  file: string;
  id: TutorialId;
  group: TutorialGroup;
  /** Its length as shown on the card: the real one once recorded (demo.save() returns it; cardLength() formats it). */
  length: string;
}

/** In the order they are meant to be watched: Next in the player goes down this list. */
export const TUTORIALS: Tutorial[] = [
  { id: 'overview', group: 'start', file: '01-what-is-it', length: '1:30' },
  { id: 'start', group: 'start', file: '02-getting-started', length: '2:00' },
  { id: 'edit', group: 'work', file: '03-editing', length: '2:30' },
  { id: 'share', group: 'share', file: '04-sharing', length: '1:45' },
];

export const GROUPS: TutorialGroup[] = ['start', 'work', 'share'];

export const videoUrl = (t: Tutorial) => `/guide/video/${t.file}.mp4`;
export const posterUrl = (t: Tutorial) => `/guide/video/${t.file}.jpg`;
