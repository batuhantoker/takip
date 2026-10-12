import type { AddProtocolAction } from 'maplibre-gl';

/** The /api/weather-grid payload. Points are row-major: `lats` outer, `lngs` inner. */
export interface WeatherGrid {
  time: string;
  lats: number[];
  lngs: number[];
  points: {
    lat: number; lng: number;
    temp: number | null; wind: number | null; windDir: number | null; gust: number | null;
    precip: number | null; cloud: number | null; code: number | null;
  }[];
}

export const WX_PROTOCOL = 'osiris-wx';
export const WX_ATTRIBUTION = '<a href="https://open-meteo.com/" target="_blank" rel="noopener">Weather © Open-Meteo.com</a> (CC BY 4.0)';
export const RADAR_ATTRIBUTION = '<a href="https://www.rainviewer.com/" target="_blank" rel="noopener">Radar © RainViewer</a>';
/** RainViewer's free tiles stop at z7 and answer deeper zooms with a placeholder image. */
export const RADAR_MAX_ZOOM = 7;
/** The grid is 10°; deeper tiles would only resample the same numbers. */
export const FIELD_MAX_ZOOM = 3;
const TILE_PX = 128;

/** Bilinear temperature at a point. Longitude wraps; latitude clamps to the outer rows. */
export function temperatureAt(grid: WeatherGrid, lat: number, lng: number): number | null {
  const { lats, lngs, points } = grid;
  const rows = lats.length, cols = lngs.length;
  if (rows < 2 || cols < 2 || points.length !== rows * cols) return null;

  const fy = Math.min(Math.max((lat - lats[0]) / (lats[1] - lats[0]), 0), rows - 1);
  const fx = ((((lng - lngs[0]) / (lngs[1] - lngs[0])) % cols) + cols) % cols;
  const y0 = Math.min(Math.floor(fy), rows - 2), ty = fy - y0;
  const x0 = Math.floor(fx) % cols, x1 = (x0 + 1) % cols, tx = fx - Math.floor(fx);

  const corners: [number | null, number][] = [
    [points[y0 * cols + x0].temp, (1 - tx) * (1 - ty)],
    [points[y0 * cols + x1].temp, tx * (1 - ty)],
    [points[(y0 + 1) * cols + x0].temp, (1 - tx) * ty],
    [points[(y0 + 1) * cols + x1].temp, tx * ty],
  ];
  // A missing corner drops out and the others are re-weighted, so one gap is not a hole.
  let sum = 0, weight = 0;
  for (const [v, w] of corners) if (v != null) { sum += v * w; weight += w; }
  return weight > 0 ? sum / weight : null;
}

const RAMP: [number, [number, number, number]][] = [
  [-40, [99, 25, 150]],
  [-25, [60, 64, 200]],
  [-10, [70, 140, 230]],
  [0, [150, 215, 240]],
  [10, [110, 200, 120]],
  [20, [240, 220, 90]],
  [30, [245, 140, 50]],
  [40, [200, 40, 40]],
  [50, [120, 0, 30]],
];

export function temperatureColor(t: number): [number, number, number] {
  if (t <= RAMP[0][0]) return RAMP[0][1];
  for (let i = 1; i < RAMP.length; i++) {
    const [t1, c1] = RAMP[i];
    if (t <= t1) {
      const [t0, c0] = RAMP[i - 1];
      const k = (t - t0) / (t1 - t0);
      return [0, 1, 2].map(j => Math.round(c0[j] + (c1[j] - c0[j]) * k)) as [number, number, number];
    }
  }
  return RAMP[RAMP.length - 1][1];
}

/** RGBA pixels for one Web Mercator tile of the temperature field. */
export function renderTemperatureTile(grid: WeatherGrid, z: number, x: number, y: number, size = TILE_PX): Uint8ClampedArray {
  const out = new Uint8ClampedArray(size * size * 4);
  const n = 2 ** z;
  for (let py = 0; py < size; py++) {
    const my = (y + (py + 0.5) / size) / n;
    const lat = (Math.atan(Math.sinh(Math.PI * (1 - 2 * my))) * 180) / Math.PI;
    for (let px = 0; px < size; px++) {
      const lng = ((x + (px + 0.5) / size) / n) * 360 - 180;
      const t = temperatureAt(grid, lat, lng);
      if (t == null) continue;
      const [r, g, b] = temperatureColor(t);
      const o = (py * size + px) * 4;
      out[o] = r; out[o + 1] = g; out[o + 2] = b; out[o + 3] = 255;
    }
  }
  return out;
}

let current: WeatherGrid | null = null;
let installed = false;

export function setWeatherGrid(grid: WeatherGrid | null): void {
  current = grid;
}

/** Tile URL for the field; the hour in the query busts MapLibre's tile cache when the grid moves on. */
export const fieldTileUrl = (grid: WeatherGrid | null) =>
  `${WX_PROTOCOL}://temperature/{z}/{x}/{y}?t=${encodeURIComponent(grid?.time ?? 'none')}`;

export function installWeatherProtocol(addProtocol: (name: string, handler: AddProtocolAction) => void): void {
  if (installed) return;
  addProtocol(WX_PROTOCOL, async params => {
    const m = /\/(\d+)\/(\d+)\/(\d+)(?:\?|$)/.exec(params.url);
    const canvas = new OffscreenCanvas(TILE_PX, TILE_PX);
    if (m && current) {
      const [z, x, y] = m.slice(1).map(Number);
      const ctx = canvas.getContext('2d')!;
      const image = ctx.createImageData(TILE_PX, TILE_PX);
      image.data.set(renderTemperatureTile(current, z, x, y));
      ctx.putImageData(image, 0, 0);
    }
    const blob = await canvas.convertToBlob({ type: 'image/png' });
    return { data: await blob.arrayBuffer() };
  });
  installed = true;
}

/** WMO weather interpretation codes, as Open-Meteo reports them. */
export function weatherLabel(code: number | null | undefined): string {
  if (code == null) return 'Unknown';
  if (code === 0) return 'Clear sky';
  if (code <= 2) return 'Partly cloudy';
  if (code === 3) return 'Overcast';
  if (code === 45 || code === 48) return 'Fog';
  if (code >= 51 && code <= 57) return 'Drizzle';
  if (code >= 61 && code <= 67) return 'Rain';
  if (code >= 71 && code <= 77) return 'Snow';
  if (code >= 80 && code <= 82) return 'Rain showers';
  if (code === 85 || code === 86) return 'Snow showers';
  if (code >= 95) return 'Thunderstorm';
  return 'Unknown';
}

/** Latest RainViewer radar frame as an XYZ tile template, or null when none is published. */
export async function latestRadarTiles(signal?: AbortSignal): Promise<string | null> {
  const res = await fetch('https://api.rainviewer.com/public/weather-maps.json', { signal, cache: 'no-store' });
  if (!res.ok) return null;
  const body = await res.json();
  const frame = body?.radar?.past?.at?.(-1);
  if (!body?.host || !frame?.path) return null;
  // 256px tiles, colour scheme 2 (universal blue), smoothed, snow shown.
  return `${body.host}${frame.path}/256/{z}/{x}/{y}/2/1_1.png`;
}
