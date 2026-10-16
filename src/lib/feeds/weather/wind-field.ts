/*
 * The GFS 10 m wind field the wind layer draws (/api/weather-field/wind): eastward (u) and northward (v)
 * wind in m/s on a regular grid, rows north to south. A forecast valid at `time`, not an observation.
 */

export interface WindField {
  /** Valid time of the forecast step, ISO. */
  time: string;
  lat0: number; dLat: number;
  lng0: number; dLng: number;
  rows: number; cols: number;
  u: Float32Array;
  v: Float32Array;
}

export const WIND_ATTRIBUTION = '<a href="https://www.ncei.noaa.gov/products/weather-climate-models/global-forecast" target="_blank" rel="noopener">Wind: NOAA GFS forecast</a> via <a href="https://www.unidata.ucar.edu/software/tds/" target="_blank" rel="noopener">Unidata THREDDS</a>';

// On the wire: a JSON header line, then u and v as int16 LE tenths of m/s, each delta-coded in row-major order.
const GAP = -32768;

function put(view: DataView, at: number, values: Float32Array) {
  let prev = 0;
  for (let i = 0; i < values.length; i++) {
    const q = Number.isNaN(values[i]) ? GAP : Math.round(values[i] * 10);
    // setInt16 wraps, and so does the decoder.
    view.setInt16(at + i * 2, q - prev, true);
    prev = q;
  }
}

function take(view: DataView, at: number, n: number): Float32Array {
  const out = new Float32Array(n);
  let q = 0;
  for (let i = 0; i < n; i++) {
    q = ((q + view.getInt16(at + i * 2, true)) << 16) >> 16;
    out[i] = q === GAP ? NaN : q / 10;
  }
  return out;
}

export function encodeWind(field: WindField): Uint8Array {
  const { u, v, ...header } = field;
  const head = new TextEncoder().encode(JSON.stringify(header) + '\n');
  const out = new Uint8Array(head.length + u.length * 4);
  out.set(head);
  const view = new DataView(out.buffer, head.length);
  put(view, 0, u);
  put(view, u.length * 2, v);
  return out;
}

export function decodeWind(buf: ArrayBuffer): WindField {
  const bytes = new Uint8Array(buf);
  const nl = bytes.indexOf(10);
  if (nl < 0) throw new Error('Wind field has no header');
  const header: Omit<WindField, 'u' | 'v'> = JSON.parse(new TextDecoder().decode(bytes.subarray(0, nl)));
  const n = header.rows * header.cols;
  const view = new DataView(buf, nl + 1);
  if (view.byteLength !== n * 4) throw new Error(`Wind field holds ${view.byteLength / 4} of ${n} cells`);
  return { ...header, u: take(view, 0, n), v: take(view, n * 2, n) };
}

/** Bilinear u and v at a point, written into `out`, leaving gap cells out; false off the grid or among gaps. Longitude wraps. */
export function windAt(f: WindField, lat: number, lng: number, out: [number, number]): boolean {
  const y = (lat - f.lat0) / f.dLat;
  if (y < 0 || y > f.rows - 1) return false;
  const x = ((((lng - f.lng0) / f.dLng) % f.cols) + f.cols) % f.cols;
  const x0 = Math.floor(x), y0 = Math.min(Math.floor(y), f.rows - 2);
  const tx = x - x0, ty = y - y0;
  let u = 0, v = 0, weight = 0;
  for (let k = 0; k < 4; k++) {
    const i = (y0 + (k >> 1)) * f.cols + ((x0 + (k & 1)) % f.cols);
    const w = (k & 1 ? tx : 1 - tx) * (k >> 1 ? ty : 1 - ty);
    if (w === 0 || Number.isNaN(f.u[i]) || Number.isNaN(f.v[i])) continue;
    u += f.u[i] * w; v += f.v[i] * w; weight += w;
  }
  if (weight === 0) return false;
  out[0] = u / weight;
  out[1] = v / weight;
  return true;
}

/* The forecast time the wind layer is drawing, for its note in the layer list; null when it draws the fallback arrows. */

let drawnTime: string | null = null;
const listeners = new Set<() => void>();
export const windDrawnTime = () => drawnTime;
export function subscribeWindTime(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
export function setWindDrawnTime(time: string | null) {
  if (time === drawnTime) return;
  drawnTime = time;
  listeners.forEach(l => l());
}
