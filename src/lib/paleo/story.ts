import type { ReplayClock } from '@/lib/replay/clock';
import { atMa, maAt } from './deep-time';

/*
 * Deep time's documentary: chapters along the deep clock, each pinned to a place that rides its plate.
 * Playing, the clock runs on to the next chapter, the camera follows its place, and the chapter waits
 * long enough to be read before moving on.
 */

export type Chapter = {
  ma: number;
  title: string;
  /** lon, lat on today's map. */
  place: [number, number];
  zoom: number;
  body: string;
  facts?: [string, string][];
  /** Whether the place gets a pin on the map; false for a chapter that is only a view. */
  pin?: boolean;
};

export const CHAPTERS: Chapter[] = [
  {
    ma: 1800, title: 'Nuna gathers', place: [-99, 52], zoom: 1.7,
    body: "The ancient cores of North America, Greenland, Baltica and Siberia crowd together into Nuna, also called Columbia, one of Earth's first supercontinents. There is far less oxygen in the air than today.",
    facts: [['Life', 'Single cells']],
  },
  {
    ma: 1000, title: 'Rodinia', place: [-76, 47], zoom: 1.8,
    body: 'Collisions all round Laurentia, the core of North America, weld the continents into Rodinia. The Grenville mountains they raised are worn down now, but their roots still run from Labrador to Texas.',
    facts: [['Life', 'Microbes, the first algae']],
  },
  {
    ma: 700, title: 'Snowball Earth', place: [16, -20], zoom: 1.8,
    body: 'Rodinia is coming apart. Twice in the Cryogenian, between 720 and 635 million years ago, ice sheets reach the tropics and may cover nearly the whole planet. Rocks they left lie in Namibia, among other places.',
    facts: [['Life', 'Microbes, algae, sponges?']],
  },
  {
    ma: 518, title: 'Animals everywhere', place: [102.95, 24.67], zoom: 2.2,
    body: 'In the Cambrian explosion most groups of animals alive today appear in the fossil record within some 20 million years. The Chengjiang beds of southern China keep them in fine detail, soft parts and all.',
    facts: [['Life', 'The first animals with eyes and shells']],
  },
  {
    ma: 445, title: 'Ice over the Sahara', place: [5, 25], zoom: 1.8,
    body: 'Gondwana drifts over the South Pole and ice sheets spread across what is now the Sahara. The cold and the falling seas bring the first of the big five mass extinctions: about 85% of marine species vanish.',
    facts: [['Species lost', '~85% of marine']],
  },
  {
    ma: 375, title: 'Fish come ashore', place: [-83, 77], zoom: 2,
    body: 'Tiktaalik, a fish with sturdy fins and a neck, hunts in the shallows of a river delta. Its bones were found on Ellesmere Island in the Canadian Arctic, which then lay on the equator.',
    facts: [['Life', 'Forests, insects, the first four-legged animals']],
  },
  {
    ma: 310, title: 'Coal forests', place: [-2, 53.5], zoom: 2,
    body: "Swamps of giant club mosses and tree ferns grow along the equator. Buried and pressed, they become the coal of Europe and North America. Oxygen climbs well above today's 21%.",
    facts: [['Life', 'Giant insects, the first reptiles']],
  },
  {
    ma: 252, title: 'The Great Dying', place: [88.2, 69.3], zoom: 1.9,
    body: 'Pangaea is whole. In Siberia, eruptions bury millions of square kilometres in lava and pour out carbon dioxide. The planet heats, the oceans lose their oxygen, and about 90% of marine species die: the worst extinction known.',
    facts: [['Species lost', '~90% of marine']],
  },
  {
    ma: 201, title: 'The Atlantic begins', place: [-74, 41], zoom: 2,
    body: 'Pangaea starts to tear between North America and Africa. The floods of lava along the rift coincide with the end-Triassic extinction, which clears the way for the dinosaurs.',
    facts: [['Species lost', '~75%']],
  },
  {
    ma: 66, title: 'The asteroid', place: [-89.5, 21.4], zoom: 2.4,
    body: 'A rock some 10 km across hits the sea off Yucatán. Soot and dust darken the sky for years, and three quarters of species die, every dinosaur but the birds among them. In India, the Deccan Traps are erupting too.',
    facts: [['Species lost', '~75%']],
  },
  {
    ma: 50, title: 'India meets Asia', place: [77, 28.6], zoom: 2.2,
    body: 'After crossing the ocean at up to 15 cm a year, India runs into Asia. The collision has not stopped: it is still raising the Himalaya and the Tibetan Plateau.',
  },
  {
    ma: 34, title: 'Antarctica freezes', place: [100, -78], zoom: 1.7,
    body: 'Australia has pulled away and seaways open round Antarctica. As carbon dioxide falls, the first lasting ice sheets spread over the continent, and they have stayed ever since.',
  },
  {
    ma: 0, title: 'Today', place: [20, 10], zoom: 1.6, pin: false,
    body: 'The plates still move, about as fast as fingernails grow: a few centimetres a year. In a few hundred million years the continents may gather into a new supercontinent.',
  },
];

/** Today's places named on the moving map, each on the plate under it. */
export const PLACES: [string, number, number][] = [
  ['North America', -99, 52],
  ['South America', -55, -10],
  ['Greenland', -42, 72],
  ['Europe', 32, 56],
  ['Africa', 22, 2],
  ['Arabia', 45, 23],
  ['Madagascar', 46.5, -19.5],
  ['India', 78, 18],
  ['Siberia', 105, 63],
  ['China', 113, 36],
  ['Australia', 133, -25],
  ['Antarctica', 100, -78],
];

/** A run from one chapter to the next takes longer the further it goes, within these bounds. */
const LEG_MIN_MS = 4000;
const LEG_MAX_MS = 12_000;
const LEG_MA_PER_S = 60;

export function legMs(fromMa: number, toMa: number) {
  return Math.min(LEG_MAX_MS, Math.max(LEG_MIN_MS, (Math.abs(fromMa - toMa) / LEG_MA_PER_S) * 1000));
}

/** Speed through a run, by how far along it is: easing out of one chapter and into the next, never quite stopping. */
const EASE_FLOOR = 0.15;
const ease = (p: number) => Math.max(EASE_FLOOR, Math.sin(Math.PI * Math.min(1, Math.max(0, p))));
/** ∫ dp / ease(p) over the run: how much longer than flat out an eased run takes. */
const EASE_STRETCH = (() => {
  let sum = 0;
  for (let i = 0; i < 1000; i++) sum += 1 / ease((i + 0.5) / 1000);
  return sum / 1000;
})();
const READ_MS_PER_WORD = 300;
const MIN_READ_MS = 9000;

export type Story = {
  /** The open chapter, or null when the story is closed. */
  index(): number | null;
  /** Moving on by itself once a chapter has been read. */
  auto(): boolean;
  /** The clock has reached the open chapter. */
  arrived(): boolean;
  /** How long the run to the open chapter takes, in ms; 0 once there. */
  legMs(): number;
  go(i: number): void;
  next(): void;
  prev(): void;
  setAuto(on: boolean): void;
  /** The viewer took the clock: stop running to the chapter and waiting on it. */
  hold(): void;
  close(): void;
  subscribe(listener: () => void): () => void;
  dispose(): void;
};

type Timers = { set: (fn: () => void, ms: number) => unknown; clear: (handle: unknown) => void };
const realTimers: Timers = { set: (fn, ms) => setTimeout(fn, ms), clear: h => clearTimeout(h as ReturnType<typeof setTimeout>) };

/** `clock` counts years from today; `onOpen` runs as the first chapter opens. */
export function createStory(clock: ReplayClock, { chapters = CHAPTERS, onOpen = () => {}, timers = realTimers } = {}): Story {
  let index: number | null = null;
  let auto = false;
  let arrived = false;
  let target = 0;
  let leg = 0;
  let wait: unknown;
  let travelling: (() => void) | null = null;
  let speedBefore: number | null = null;
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach(l => l());

  const stopTravel = () => {
    travelling?.();
    travelling = null;
  };

  const readThenNext = () => {
    timers.clear(wait);
    if (index === null) return;
    const words = chapters[index].body.split(/\s+/).length;
    wait = timers.set(() => {
      if (index !== null && index < chapters.length - 1) story.go(index + 1);
      else {
        auto = false;
        emit();
      }
    }, Math.max(MIN_READ_MS, words * READ_MS_PER_WORD));
  };

  const arrive = () => {
    stopTravel();
    clock.pause();
    clock.seek(target);
    arrived = true;
    leg = 0;
    if (auto) readThenNext();
    emit();
  };

  const story: Story = {
    index: () => index,
    auto: () => auto,
    arrived: () => arrived,
    legMs: () => leg,
    go(i) {
      const next = Math.max(0, Math.min(chapters.length - 1, i));
      timers.clear(wait);
      stopTravel();
      if (index === null) {
        speedBefore = clock.speed();
        onOpen();
      }
      index = next;
      arrived = false;
      target = atMa(chapters[next].ma);
      // Only forward runs: the clock doesn't play backwards, so an earlier chapter is a cut.
      const from = clock.time();
      if (target > from) {
        leg = legMs(maAt(from), chapters[next].ma);
        const peak = (EASE_STRETCH * (target - from)) / leg;
        let steering = false;
        const steer = () => {
          if (steering) return;
          if (clock.time() >= target || !clock.playing()) return arrive();
          steering = true;
          clock.setSpeed(peak * ease((clock.time() - from) / (target - from)));
          steering = false;
        };
        clock.setSpeed(peak * EASE_FLOOR);
        travelling = clock.subscribe(steer);
        clock.play();
        if (!clock.playing()) arrive();
      } else arrive();
      emit();
    },
    next() {
      if (index !== null && index < chapters.length - 1) story.go(index + 1);
    },
    prev() {
      if (index !== null && index > 0) story.go(index - 1);
    },
    setAuto(on) {
      auto = on;
      if (!on) timers.clear(wait);
      else if (arrived) {
        if (index === chapters.length - 1) story.go(0);
        else readThenNext();
      }
      emit();
    },
    hold() {
      if (!travelling && !auto) return;
      timers.clear(wait);
      stopTravel();
      auto = false;
      arrived = true;
      emit();
    },
    close() {
      if (index === null) return;
      timers.clear(wait);
      stopTravel();
      index = null;
      auto = false;
      if (speedBefore !== null) clock.setSpeed(speedBefore);
      speedBefore = null;
      emit();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    dispose() {
      timers.clear(wait);
      stopTravel();
      listeners.clear();
    },
  };
  return story;
}
