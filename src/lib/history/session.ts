import { atMa } from '@/lib/paleo/deep-time';
import { createStory, type Story } from '@/lib/paleo/story';
import { createReplayClock, type ReplayClock } from '@/lib/replay/clock';
import { type CountryView, createCountryView } from './country-view';

/*
 * The History tab's state outside React: its own clock (years, not the hours Replay records), which event
 * families are on, and what fills the countries: a metric, or wartime borders. Deep time swaps all of that for
 * the plate model on a clock of its own, millions of years long. Replay and History never run together.
 */

/** Wars and battles start on; attacks (181k GTD rows) and the rest wait to be asked for. */
export const DEFAULT_FAMILIES = ['conflict'];
const MONTH_SPEED = 30 * 86_400;
/** Deep time opens on Pangaea, five million years a second (the deep clock counts years, so this is years per ms). */
const DEEP_START_MA = 250;
const DEEP_SPEED = 5000;

export type HistorySession = {
  clock: ReplayClock;
  /** Deep time's clock: years from today, negative into the past, playing on to now. */
  deepClock: ReplayClock;
  /** The documentary along the deep clock; opening a chapter turns deep time on. */
  story: Story;
  /** The map shows the moving plates instead of the calendar's countries and events. */
  deep(): boolean;
  setDeep(on: boolean): void;
  countries: CountryView;
  families(): string[];
  setFamily(family: string, on: boolean): void;
  /** Wartime border layers shown (war-layers.ts); either these or a country metric fill the map, not both. */
  layers(): string[];
  setLayer(code: string, on: boolean): void;
  /** Called when the families, layers or deep time change. */
  subscribe(listener: () => void): () => void;
  dispose(): void;
};

export function createHistorySession(start: number, get: typeof fetch = fetch): HistorySession {
  const clock = createReplayClock(start);
  clock.setSpeed(MONTH_SPEED);
  const countries = createCountryView(clock, get);
  const deepClock = createReplayClock(atMa(DEEP_START_MA), { now: () => 0 });
  deepClock.setSpeed(DEEP_SPEED);
  const listeners = new Set<() => void>();
  let families = [...DEFAULT_FAMILIES];
  let layers: string[] = [];
  let deep = false;
  // The calendar's colouring and play state, put back on leaving deep time; its border layers simply wait.
  let calendar: { view: { code: string; source?: string } | null; playing: boolean } | null = null;
  const emit = () => listeners.forEach(l => l());

  const setDeep = (on: boolean) => {
    if (deep === on) return;
    deep = on;
    if (on) {
      const v = countries.state();
      calendar = { view: v.status === 'off' ? null : { code: v.code, source: v.status === 'ready' ? v.data.source.code : undefined }, playing: clock.playing() };
      clock.pause();
      countries.select(null);
    } else {
      story.close();
      deepClock.pause();
      if (calendar?.view) countries.select(calendar.view.code, calendar.view.source);
      if (calendar?.playing) clock.play();
      calendar = null;
    }
    emit();
  };
  const story = createStory(deepClock, { onOpen: () => setDeep(true) });
  const offCountries = countries.subscribe(() => {
    if (countries.state().status === 'off' || !layers.length) return;
    layers = [];
    emit();
  });
  return {
    clock,
    deepClock,
    story,
    deep: () => deep,
    setDeep,
    countries,
    families: () => families,
    setFamily(family, on) {
      if (families.includes(family) === on) return;
      families = on ? [...families, family] : families.filter(f => f !== family);
      emit();
    },
    layers: () => (deep ? [] : layers),
    setLayer(code, on) {
      if (layers.includes(code) === on) return;
      layers = on ? [...layers, code] : layers.filter(l => l !== code);
      if (on) countries.select(null);
      emit();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    dispose() {
      offCountries();
      story.dispose();
      deepClock.dispose();
      clock.dispose();
      countries.select(null);
      listeners.clear();
    },
  };
}
