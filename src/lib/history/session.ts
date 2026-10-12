import { createReplayClock, type ReplayClock } from '@/lib/replay/clock';
import { type CountryView, createCountryView } from './country-view';

/*
 * The History tab's state outside React: its own clock (years, not the hours Replay records), which event
 * families are on, and the country colouring. Replay and History never run together.
 */

/** Wars and battles start on; attacks (181k GTD rows) and the rest wait to be asked for. */
export const DEFAULT_FAMILIES = ['conflict'];
const MONTH_SPEED = 30 * 86_400;

export type HistorySession = {
  clock: ReplayClock;
  countries: CountryView;
  families(): string[];
  setFamily(family: string, on: boolean): void;
  /** Called when the families change. */
  subscribe(listener: () => void): () => void;
  dispose(): void;
};

export function createHistorySession(start: number, get: typeof fetch = fetch): HistorySession {
  const clock = createReplayClock(start);
  clock.setSpeed(MONTH_SPEED);
  const countries = createCountryView(clock, get);
  const listeners = new Set<() => void>();
  let families = [...DEFAULT_FAMILIES];
  return {
    clock,
    countries,
    families: () => families,
    setFamily(family, on) {
      if (families.includes(family) === on) return;
      families = on ? [...families, family] : families.filter(f => f !== family);
      listeners.forEach(l => l());
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    dispose() {
      clock.dispose();
      countries.select(null);
      listeners.clear();
    },
  };
}
