/** Map layer toggle → the catalogue category it shows. */
const CATEGORY_LAYERS: [string, string][] = [
  ['sat_comms', 'comms'],
  ['sat_military', 'military'],
  ['sat_navigation', 'navigation'],
  ['sat_earth', 'earth_obs'],
  ['sat_science', 'science'],
];

/** The satellites the layer toggles show: all of them under "satellites", else the categories switched on, else none. */
export function shownSatellites<T>(sats: readonly T[] | undefined, layers: object): T[] {
  const on = layers as Record<string, unknown>;
  if (!sats?.length) return [];
  if (on.satellites) return [...sats];
  const categories = CATEGORY_LAYERS.filter(([layer]) => on[layer]).map(([, category]) => category);
  return categories.length ? sats.filter(s => categories.includes(String((s as { category?: string }).category))) : [];
}
