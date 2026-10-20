/** What a short is made of, before it has a voice or a language. Stories and tours build these. */

/** One spoken step: what is said, and what the page does meanwhile. */
export interface Beat {
  id: string;
  /** The voiceover line in English; each language gets a translation. */
  say: string;
  /** A short heading shown with this beat, in English. */
  title?: string;
  /** The opening beat shows its line big; the closing one shows the end card. */
  card?: 'hook' | 'end';
  /** How long the picture needs whatever the voice does, e.g. a camera leg, in ms. */
  minMs?: number;
  /** Page JavaScript run as the beat starts. */
  enter?: string;
  /** Page JavaScript run before every frame of the beat, with `p` (0–1 through it) and `ms` (since it began) in scope. */
  frame?: string;
  /** Taps on the interface, `at` ms into the beat, shown with a ring where the finger lands. With `expect`
   *  (page JavaScript), a tap that hasn't taken effect shortly after is made again. */
  taps?: { at: number; selector: string; expect?: string }[];
}

export interface Counter {
  /** Page JavaScript returning the number, read every frame (a clock, a count). */
  expr: string;
  /** English template with {n}, e.g. "{n} million years ago". */
  unit: string;
  /** Digits after the point. */
  digits?: number;
  /** A year prints without grouping, and before year 1 as "300 BCE"; a date is epoch ms, printed as "7 December 1941". */
  kind?: 'number' | 'year' | 'date';
}

export interface Scene {
  /** Folder name under data/shorts/<day>/, e.g. "deep-time". */
  id: string;
  kind: 'story' | 'tour';
  /** App path and query to open, e.g. "/?view=deep&ma=260". */
  path: string;
  /** Stories show only the map; tours keep the app's interface. */
  chrome: 'map-only' | 'app';
  /** Page JavaScript that is true once the view is ready to film, beyond the map having loaded. */
  ready?: string;
  /** Page JavaScript run once ready, before time is frozen. */
  setup?: string;
  /** A frame waits only for requests whose URL matches this (a RegExp source); all requests without it. */
  waitOn?: string;
  /** The small label over the opening line, e.g. "Deep time". */
  kicker: string;
  counter?: Counter;
  /** A colour key for a choropleth: English label, and page JavaScript returning { lo, hi } or null. */
  legend?: { label: string; expr: string };
  /** In order; the first is usually the hook and the last the end card. */
  beats: Beat[];
  /** Credits, on screen and in the post. */
  sources: string[];
  post: { title: string; description: string; hashtags: string[] };
}

/** Everything a viewer reads or hears, in one language. Written to script.<lang>.json, which can be edited before rendering. */
export interface Script {
  lang: string;
  kicker: string;
  unit?: string;
  legend?: string;
  /** `spoken` is the line as the narrator reads it, numbers in words; `say` is shown in the captions. */
  beats: { id: string; say: string; title?: string; spoken?: string }[];
  /** Fixed words of the overlay. */
  ui: { sources: string; explore: string; bce: string };
  post: { title: string; description: string; hashtags: string[] };
}

export function englishScript(scene: Scene): Script {
  return {
    lang: 'en',
    kicker: scene.kicker,
    unit: scene.counter?.unit,
    ...(scene.legend ? { legend: scene.legend.label } : {}),
    beats: scene.beats.map(b => ({ id: b.id, say: b.say, ...(b.title ? { title: b.title } : {}) })),
    ui: { sources: 'Sources', explore: 'Explore it live', bce: 'BCE' },
    post: scene.post,
  };
}
