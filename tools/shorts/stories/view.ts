/** The filmed page's CSS size (capture/film.ts VIEWPORT) and what a camera there takes in. */
const VIEW = { width: 432, height: 768 };

/** West, south, east, north of the view at a centre and zoom (MapLibre's 512 px tiles). */
export function viewBox(lat: number, lon: number, zoom: number): [number, number, number, number] {
  const degPerPx = 360 / (512 * 2 ** zoom);
  const w = (VIEW.width / 2) * degPerPx;
  const h = (VIEW.height / 2) * degPerPx * Math.cos((lat * Math.PI) / 180);
  return [lon - w, Math.max(-85, lat - h), lon + w, Math.min(85, lat + h)];
}

export const inBox = ([w, s, e, n]: [number, number, number, number], lat: number, lon: number) => lat >= s && lat <= n && lon >= w && lon <= e;
