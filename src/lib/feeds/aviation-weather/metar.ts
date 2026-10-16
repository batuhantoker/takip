/**
 * Airport weather from the aviationweather.gov METAR cache: the latest report of every station heard in
 * the last ~90 minutes, worldwide, with NOAA's own flight category.
 */

export const METAR_CACHE_URL = 'https://aviationweather.gov/data/cache/metars.cache.csv.gz';

export const FLIGHT_CATEGORIES = ['VFR', 'MVFR', 'IFR', 'LIFR'] as const;
export type FlightCategory = (typeof FLIGHT_CATEGORIES)[number];

export interface AirportWx {
  /** ICAO station id. */
  id: string;
  lat: number;
  lng: number;
  cat: FlightCategory | null;
  /** Observation time, ISO. */
  at: string;
  raw: string;
  tempC?: number;
  dewC?: number;
  windDir?: number;
  windKt?: number;
  gustKt?: number;
  /** Statute miles as NOAA writes it: "10+", "4.97". */
  visSm?: string;
  /** Lowest broken or overcast layer, or the vertical visibility, in feet. */
  ceilingFt?: number;
  wx?: string;
}

/** One CSV line into fields; METAR text is quoted and may hold commas. */
export function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '', quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}

const num = (s: string | undefined) => {
  if (s == null || s.trim() === '') return undefined;
  const v = Number(s);
  return Number.isFinite(v) ? v : undefined;
};

const CEILING_COVER = new Set(['BKN', 'OVC', 'OVX']);

export function parseMetarCsv(text: string): AirportWx[] {
  const lines = text.split(/\r?\n/);
  // Older copies of the file put a few status lines above the header.
  const start = lines.findIndex(l => l.startsWith('raw_text,'));
  if (start < 0) throw new Error('METAR cache: no header row');
  const header = splitCsvLine(lines[start]);
  const col = (name: string) => header.indexOf(name);
  // sky_cover and cloud_base_ft_agl repeat once per cloud layer.
  const all = (name: string) => header.flatMap((h, i) => (h === name ? [i] : []));
  const c = {
    raw: col('raw_text'), id: col('station_id'), at: col('observation_time'), lat: col('latitude'), lng: col('longitude'),
    temp: col('temp_c'), dew: col('dewpoint_c'), dir: col('wind_dir_degrees'), kt: col('wind_speed_kt'), gust: col('wind_gust_kt'),
    vis: col('visibility_statute_mi'), wx: col('wx_string'), cat: col('flight_category'), vv: col('vert_vis_ft'),
    cover: all('sky_cover'), base: all('cloud_base_ft_agl'),
  };

  const byStation = new Map<string, AirportWx>();
  for (const line of lines.slice(start + 1)) {
    if (!line) continue;
    const f = splitCsvLine(line);
    const id = f[c.id], lat = num(f[c.lat]), lng = num(f[c.lng]);
    if (!id || lat == null || lng == null) continue;
    const cat = f[c.cat] as FlightCategory;
    let ceilingFt = num(f[c.vv]);
    c.cover.forEach((ci, k) => {
      const base = num(f[c.base[k]]);
      if (CEILING_COVER.has(f[ci]) && base != null && (ceilingFt == null || base < ceilingFt)) ceilingFt = base;
    });
    const row: AirportWx = {
      id, lat, lng,
      cat: FLIGHT_CATEGORIES.includes(cat) ? cat : null,
      at: f[c.at],
      raw: f[c.raw],
      tempC: num(f[c.temp]), dewC: num(f[c.dew]),
      windDir: num(f[c.dir]), windKt: num(f[c.kt]), gustKt: num(f[c.gust]),
      visSm: f[c.vis] || undefined,
      ceilingFt,
      wx: f[c.wx] || undefined,
    };
    const prev = byStation.get(id);
    if (!prev || prev.at < row.at) byStation.set(id, row);
  }
  return [...byStation.values()];
}
