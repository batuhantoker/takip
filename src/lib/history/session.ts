import { atMa } from '@/lib/history/paleo/deep-time';
import { createStory, type Story } from '@/lib/history/paleo/story';
import { createReplayClock, type ReplayClock } from '@/lib/map/replay/clock';
import { type CountryChart, createCountryChart } from './countries/chart';
import { familiesOfKinds } from './kinds';
import { type CountryView, createCountryView, type PicksSnapshot } from './countries/view';
import { type Projection, projectionEnd } from './projection';

/*
 * The History tab's state outside React: its own clock (years, not the hours Replay records), which event
 * families are on, and what fills the countries: a metric, or wartime borders. Deep time swaps all of that for
 * the plate model on a clock of its own, millions of years long. Replay and History never run together.
 * The clock stops at today, unless the countries show projections: then it runs on to their end.
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
  /** Countries charted over time; kept while the colouring is off, so the next indicator charts them too. */
  chart: CountryChart;
  families(): string[];
  setFamily(family: string, on: boolean): void;
  /** Only these event kinds are drawn (a topic page's link); empty draws every kind of the families on. */
  kinds(): string[];
  /** Switches the kinds' families on; switching on a family outside them later drops the filter, which would hide it. */
  setKinds(kinds: string[]): void;
  /** Border layers shown (war-layers.ts, world-borders.ts), one at a time; either these or a country metric fill the map, not both. */
  layers(): string[];
  setLayer(code: string, on: boolean): void;
  /** Called when the families, kinds, layers or deep time change. */
  subscribe(listener: () => void): () => void;
  dispose(): void;
};

export function createHistorySession(start: number, get: typeof fetch = fetch): HistorySession {
  // The clock's ceiling reads the country view, which needs the clock.
  let projection = (): Projection | null => null;
  const ceiling = () => {
    const p = projection();
    return p ? Math.max(Date.now(), projectionEnd(p)) : Date.now();
  };
  const clock = createReplayClock(start, { now: ceiling });
  clock.setSpeed(MONTH_SPEED);
  const countries = createCountryView(clock, get);
  projection = countries.projection;
  const deepClock = createReplayClock(atMa(DEEP_START_MA), { now: () => 0 });
  deepClock.setSpeed(DEEP_SPEED);
  const listeners = new Set<() => void>();
  let families = [...DEFAULT_FAMILIES];
  let kinds: string[] = [];
  let layers: string[] = [];
  let deep = false;
  // The calendar's colouring and play state, put back on leaving deep time; its border layers simply wait.
  let calendar: { view: PicksSnapshot | null; playing: boolean } | null = null;
  const emit = () => listeners.forEach(l => l());

  const setDeep = (on: boolean) => {
    if (deep === on) return;
    deep = on;
    if (on) {
      calendar = { view: countries.snapshot(), playing: clock.playing() };
      clock.pause();
      countries.select(null);
    } else {
      story.close();
      deepClock.pause();
      if (calendar?.view) countries.restore(calendar.view);
      if (calendar?.playing) clock.play();
      calendar = null;
    }
    emit();
  };
  const story = createStory(deepClock, { onOpen: () => setDeep(true) });
  const offCountries = countries.subscribe(() => {
    // Nothing but projections may stand past today.
    if (clock.time() > ceiling()) clock.seek(ceiling());
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
    chart: createCountryChart(),
    families: () => families,
    setFamily(family, on) {
      if (families.includes(family) === on) return;
      families = on ? [...families, family] : families.filter(f => f !== family);
      if (on && kinds.length && !familiesOfKinds(kinds).includes(family)) kinds = [];
      emit();
    },
    kinds: () => kinds,
    setKinds(next) {
      const wanted = familiesOfKinds(next);
      families = [...families, ...wanted.filter(f => !families.includes(f))];
      kinds = [...new Set(next)];
      emit();
    },
    layers: () => (deep ? [] : layers),
    setLayer(code, on) {
      if (layers.includes(code) === on) return;
      // Two sets of borders would paint over each other.
      layers = on ? [code] : layers.filter(l => l !== code);
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
