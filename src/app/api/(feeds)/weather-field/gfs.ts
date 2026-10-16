import type { TemperatureField } from '@/lib/feeds/weather/weather-field';
import type { WindField } from '@/lib/feeds/weather/wind-field';

/**
 * NOAA GFS 2 m temperature on its 0.25° grid, and 10 m wind, read over OPeNDAP from Unidata's
 * THREDDS "Best" collection. NOMADS retired OPeNDAP (SCN 25-81) and its filter
 * only speaks GRIB2. The data is public domain; Unidata's server is a community
 * service, so the route reads it once per 3-hour forecast step, not per reader.
 */
const BEST = 'https://thredds.ucar.edu/thredds/dodsC/grib/NCEP/GFS/Global_0p25deg/Best';
const VAR = 'Temperature_height_above_ground';
const U = 'u-component_of_wind_height_above_ground';
const V = 'v-component_of_wind_height_above_ground';
const STEP_HOURS = 3;

/** The arrays in a DAP2 `.dods` reply, by name. They come in dataset order, whatever order the query named them in. */
export function dodsArrays(buf: ArrayBuffer): Record<string, Float32Array | Float64Array> {
  const head = new TextDecoder('latin1').decode(new Uint8Array(buf, 0, Math.min(buf.byteLength, 8192)));
  const mark = head.indexOf('\nData:\n');
  if (mark < 0) throw new Error('THREDDS reply has no data section');
  const view = new DataView(buf);
  const out: Record<string, Float32Array | Float64Array> = {};
  let o = mark + 7;
  // XDR: each array is its length twice, then big-endian values.
  for (const [, type, name] of head.slice(0, mark).matchAll(/(Float32|Float64) ([\w-]+)\[/g)) {
    const size = type === 'Float64' ? 8 : 4;
    const n = view.getUint32(o);
    o += 8;
    if (o + n * size > buf.byteLength) throw new Error('THREDDS reply is cut short');
    const arr = size === 8 ? new Float64Array(n) : new Float32Array(n);
    for (let i = 0; i < n; i++, o += size) arr[i] = size === 8 ? view.getFloat64(o) : view.getFloat32(o);
    out[name] = arr;
  }
  return out;
}

async function get(url: string): Promise<Response> {
  const res = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`THREDDS answered ${res.status} for ${url.slice(BEST.length)}`);
  return res;
}

/** Index of the step nearest `hours`, or -1 when none is within one step. */
export function nearestStep(times: ArrayLike<number>, hours: number): number {
  let best = -1;
  for (let i = 0; i < times.length; i++) {
    if (best < 0 || Math.abs(times[i] - hours) < Math.abs(times[best] - hours)) best = i;
  }
  return best >= 0 && Math.abs(times[best] - hours) <= STEP_HOURS ? best : -1;
}

interface Located {
  /** Index of the forecast step nearest now, and its valid time. */
  t: number;
  time: string;
  level: number;
  rows: number;
  cols: number;
  lat0: number; dLat: number;
  lng0: number; dLng: number;
}

/** Where a variable's grid, forecast step and height level are, for the step nearest `now`. */
async function locate(name: string, height: number, now: number): Promise<Located> {
  // Dimension names and the time base move as THREDDS rolls the collection, so read them each time.
  const [dds, das] = await Promise.all([get(`${BEST}.dds`).then(r => r.text()), get(`${BEST}.das`).then(r => r.text())]);
  const dims = new RegExp(`Float32 ${name}\\[(\\w+) = \\d+\\]\\[(\\w+) = \\d+\\]\\[lat = (\\d+)\\]\\[lon = (\\d+)\\]`).exec(dds);
  if (!dims) throw new Error(`THREDDS lists no ${name} grid`);
  const [, timeDim, levelDim] = dims;
  const base = new RegExp(`\\n\\s*${timeDim} \\{\\s*String units "Hour since ([^"]+)"`).exec(das)?.[1];
  if (!base || Number.isNaN(Date.parse(base))) throw new Error(`THREDDS gives no time base for ${timeDim}`);

  const axes = await get(`${BEST}.dods?${timeDim},${levelDim},lat[0:1:1],lon[0:1:1]`).then(r => r.arrayBuffer());
  const { [timeDim]: times, [levelDim]: levels, lat, lon } = dodsArrays(axes);
  if (!times || !levels || !lat || !lon) throw new Error('THREDDS left out an axis');
  const t = nearestStep(times, (now - Date.parse(base)) / 3600_000);
  const level = levels.indexOf(height);
  if (t < 0) throw new Error('GFS has no forecast step near now');
  if (level < 0) throw new Error(`GFS lists no ${height} m level`);
  return {
    t, level, rows: Number(dims[3]), cols: Number(dims[4]),
    time: new Date(Date.parse(base) + times[t] * 3600_000).toISOString(),
    lat0: lat[0], dLat: lat[1] - lat[0], lng0: lon[0], dLng: lon[1] - lon[0],
  };
}

export async function fetchGfsTemperature(now = Date.now()): Promise<TemperatureField> {
  const { t, level, rows, cols, time, lat0, dLat, lng0, dLng } = await locate(VAR, 2, now);
  const data = await get(`${BEST}.dods?${VAR}.${VAR}[${t}][${level}][0:1:${rows - 1}][0:1:${cols - 1}]`).then(r => r.arrayBuffer());
  const kelvin = dodsArrays(data)[VAR];
  if (kelvin?.length !== rows * cols) throw new Error(`GFS returned ${kelvin?.length ?? 0} of ${rows * cols} cells`);
  return { time, lat0, dLat, lng0, dLng, rows, cols, values: Float32Array.from(kelvin, k => k - 273.15) };
}

/** GFS 10 m wind, every `stride`th cell: 2 gives 0.5°, plenty for drawing where it blows. */
export async function fetchGfsWind(now = Date.now(), stride = 2): Promise<WindField> {
  const g = await locate(U, 10, now);
  const box = `[${g.t}][${g.level}][0:${stride}:${g.rows - 1}][0:${stride}:${g.cols - 1}]`;
  const data = await get(`${BEST}.dods?${U}.${U}${box},${V}.${V}${box}`).then(r => r.arrayBuffer());
  const { [U]: u, [V]: v } = dodsArrays(data);
  const rows = Math.floor((g.rows - 1) / stride) + 1, cols = Math.floor((g.cols - 1) / stride) + 1;
  if (u?.length !== rows * cols || v?.length !== rows * cols) throw new Error(`GFS returned ${u?.length ?? 0} and ${v?.length ?? 0} of ${rows * cols} wind cells`);
  return { time: g.time, lat0: g.lat0, dLat: g.dLat * stride, lng0: g.lng0, dLng: g.dLng * stride, rows, cols, u: Float32Array.from(u), v: Float32Array.from(v) };
}
