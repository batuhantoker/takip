/**
 * Layers an embed can show over a past window, and how far back their source reaches. A layer added
 * here needs a range route and a loader in components/site/embed/hooks/use-window-data.ts.
 */
export const WINDOWED_LAYERS: ReadonlyMap<string, { since: number }> = new Map([
  // USGS ComCat: large quakes back to 1900, small ones only as far back as the networks that caught them.
  ['earthquakes', { since: Date.UTC(1900, 0, 1) }],
]);
