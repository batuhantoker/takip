import { createReplayClock, type ReplayClock } from '@/lib/replay/clock';
import { type CountryView, createCountryView } from './country-view';

/*
 * The History tab's state outside React: its own clock (years, not the hours Replay records), which event
 * families are on, and what fills the countries: a metric, or wartime borders. Replay and History never run together.
 */

/** Wars and battles start on; attacks (181k GTD rows) and the rest wait to be asked for. */
export const DEFAULT_FAMILIES = ['conflict'];
const MONTH_SPEED = 30 * 86_400;

export type HistorySession = {
  clock: ReplayClock;
  countries: CountryView;
  families(): string[];
  setFamily(family: string, on: boolean): void;
  /** Wartime border layers shown (war-layers.ts); either these or a country metric fill the map, not both. */
  layers(): string[];
  setLayer(code: string, on: boolean): void;
  /** Called when the families or layers change. */
  subscribe(listener: () => void): () => void;
  dispose(): void;
};

export function createHistorySession(start: number, get: typeof fetch = fetch): HistorySession {
  const clock = createReplayClock(start);
  clock.setSpeed(MONTH_SPEED);
  const countries = createCountryView(clock, get);
  const listeners = new Set<() => void>();
  let families = [...DEFAULT_FAMILIES];
  let layers: string[] = [];
  const emit = () => listeners.forEach(l => l());
  const offCountries = countries.subscribe(() => {
    if (countries.state().status === 'off' || !layers.length) return;
    layers = [];
    emit();
  });
  return {
    clock,
    countries,
    families: () => families,
    setFamily(family, on) {
      if (families.includes(family) === on) return;
      families = on ? [...families, family] : families.filter(f => f !== family);
      emit();
    },
    layers: () => layers,
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
      clock.dispose();
      countries.select(null);
      listeners.clear();
    },
  };
}
