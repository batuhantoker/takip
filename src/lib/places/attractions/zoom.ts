/**
 * The zoom each thing to do appears from, so the map stays even at every scale: the best known in each patch of
 * screen first, the rest as you zoom in, every one from ALL_ZOOM. Shared by the builder and the server's fallback.
 */

/** Nothing is drawn below this. */
export const FIRST_ZOOM = 3;
export const ALL_ZOOM = 14;

/** One place per cell this many pixels across: roomy far out, tighter in a city. */
const cellPx = (z: number) => Math.max(24, 80 - 6 * (z - FIRST_ZOOM));

/** Web Mercator x and y in [0, 1]. */
function mercator([lon, lat]: readonly [number, number]): [number, number] {
  const s = Math.min(0.9999, Math.max(-0.9999, Math.sin((lat * Math.PI) / 180)));
  return [(lon + 180) / 360, 0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)];
}

/** The zoom from which each item is shown, in the items' order. */
export function shownFrom(items: readonly { at: readonly [number, number]; l: number }[]): Uint8Array {
  const from = new Uint8Array(items.length).fill(ALL_ZOOM);
  const taken = Array.from({ length: ALL_ZOOM - FIRST_ZOOM }, () => new Set<number>());
  const cells = (i: number) => {
    const [x, y] = mercator(items[i].at);
    return taken.map((_, k) => {
      const n = Math.floor((256 * 2 ** (FIRST_ZOOM + k)) / cellPx(FIRST_ZOOM + k));
      return Math.floor(x * n) * n + Math.min(n - 1, Math.floor(y * n));
    });
  };
  const order = items.map((_, i) => i).sort((a, b) => items[b].l - items[a].l || a - b);
  for (const i of order) {
    const keys = cells(i);
    const k = keys.findIndex((key, z) => !taken[z].has(key));
    if (k < 0) continue;
    from[i] = FIRST_ZOOM + k;
    // It stays drawn as the map zooms in, so it keeps its cell at every closer zoom.
    for (let z = k; z < keys.length; z++) taken[z].add(keys[z]);
  }
  return from;
}
