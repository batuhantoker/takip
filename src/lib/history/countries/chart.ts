/*
 * The countries History charts over time, clicked on the map while countries are coloured. Each keeps
 * its colour slot until it is dropped, so removing one never repaints the others.
 */

/** As many as the chart palette keeps apart (SERIES_INK in map/style/tokens.ts). */
export const MAX_CHARTED = 6;

/** `key` is the countries.json `id`; `slot` indexes SERIES_INK. */
export type ChartedCountry = { key: string; name: string; slot: number };

export type CountryChart = {
  countries(): ChartedCountry[];
  /** Adds the country, or drops it if it's already there. False when the chart is full. */
  toggle(key: string, name: string): boolean;
  remove(key: string): void;
  clear(): void;
  subscribe(listener: () => void): () => void;
};

export function createCountryChart(): CountryChart {
  const listeners = new Set<() => void>();
  let list: ChartedCountry[] = [];
  const set = (next: ChartedCountry[]) => {
    list = next;
    listeners.forEach(l => l());
  };
  const remove = (key: string) => {
    if (list.some(c => c.key === key)) set(list.filter(c => c.key !== key));
  };
  return {
    countries: () => list,
    toggle(key, name) {
      if (list.some(c => c.key === key)) {
        remove(key);
        return true;
      }
      if (list.length >= MAX_CHARTED) return false;
      let slot = 0;
      while (list.some(c => c.slot === slot)) slot++;
      set([...list, { key, name, slot }]);
      return true;
    },
    remove,
    clear() {
      if (list.length) set([]);
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
