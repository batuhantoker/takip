import { httpText } from '@/lib/core/net/http-json';

/*
 * NASA FIRMS active fires: the keyless global 24-hour CSVs from the three VIIRS satellites, merged,
 * with MODIS only when none of them answers. FIRMS data is free to use with credit (NASA).
 */

const BASE = 'https://firms.modaps.eosdis.nasa.gov/data/active_fire';
export const FIRMS_VIIRS = [
  { satellite: 'S-NPP', url: `${BASE}/suomi-npp-viirs-c2/csv/SUOMI_VIIRS_C2_Global_24h.csv` },
  { satellite: 'NOAA-20', url: `${BASE}/noaa-20-viirs-c2/csv/J1_VIIRS_C2_Global_24h.csv` },
  { satellite: 'NOAA-21', url: `${BASE}/noaa-21-viirs-c2/csv/J2_VIIRS_C2_Global_24h.csv` },
] as const;
export const FIRMS_MODIS = `${BASE}/modis-c6.1/csv/MODIS_C6_1_Global_24h.csv`;

export interface FireRow {
  lat: number;
  lng: number;
  brightness: number;
  confidence: string;
  date: string;
  time: string;
  frp: number;
  type: 'fire';
  /** How many of the merged satellites saw a fire in this ~1 km cell. */
  satellites: number;
}

export function parseFirmsCsv(csv: string): FireRow[] {
  const lines = csv.trim().split('\n');
  if (lines.length < 2) return [];
  const header = lines[0].split(',');
  const col = (name: string) => header.indexOf(name);
  const latIdx = col('latitude'), lngIdx = col('longitude');
  const brightIdx = col('bright_ti4') !== -1 ? col('bright_ti4') : col('brightness');
  const confIdx = col('confidence'), dateIdx = col('acq_date'), timeIdx = col('acq_time'), frpIdx = col('frp');
  const rows: FireRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',');
    const lat = parseFloat(cols[latIdx]), lng = parseFloat(cols[lngIdx]);
    if (Number.isNaN(lat) || Number.isNaN(lng)) continue;
    rows.push({
      lat: Math.round(lat * 1000) / 1000,
      lng: Math.round(lng * 1000) / 1000,
      brightness: parseFloat(cols[brightIdx]) || 0,
      confidence: cols[confIdx]?.trim() || 'unknown',
      date: cols[dateIdx] || '',
      time: cols[timeIdx] || '',
      frp: parseFloat(cols[frpIdx]) || 0,
      type: 'fire',
      satellites: 1,
    });
  }
  return rows;
}

/** A cell of about 1 km: the three satellites pass minutes apart and see the same fire. */
const CELL_DEG = 0.01;
/** What the map draws without lag. */
export const MAX_POINTS = 5000;

/**
 * One row per cell across the satellites' lists, keeping the strongest detection. Over the cap, the
 * strongest half is kept and the rest is an even sample, so big fires always show and small ones still
 * show where they are.
 */
export function mergeDetections(lists: FireRow[][], max = MAX_POINTS): FireRow[] {
  const cells = new Map<string, FireRow>();
  const key = (x: number, y: number) => `${x}:${y}`;
  // The same fire can fall either side of a cell edge, so a row joins any held one within a cell of it.
  const near = (row: FireRow, x: number, y: number) => {
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
      const k = key(x + dx, y + dy), held = cells.get(k);
      if (held && Math.abs(held.lat - row.lat) < CELL_DEG && Math.abs(held.lng - row.lng) < CELL_DEG) return k;
    }
    return null;
  };
  for (const list of lists) {
    const counted = new Set<string>();
    for (const row of list) {
      const x = Math.floor(row.lat / CELL_DEG), y = Math.floor(row.lng / CELL_DEG);
      const k = near(row, x, y);
      if (!k) {
        cells.set(key(x, y), { ...row });
        counted.add(key(x, y));
        continue;
      }
      const held = cells.get(k)!;
      const satellites = held.satellites + (counted.has(k) ? 0 : 1);
      counted.add(k);
      cells.set(k, row.frp > held.frp ? { ...row, satellites } : { ...held, satellites });
    }
  }
  const merged = [...cells.values()];
  if (merged.length <= max) return merged;
  const strongest = new Set([...merged].sort((a, b) => b.frp - a.frp).slice(0, Math.floor(max / 2)));
  const rest = merged.filter(r => !strongest.has(r));
  const step = rest.length / (max - strongest.size);
  const sample = Array.from({ length: max - strongest.size }, (_, i) => rest[Math.floor(i * step)]);
  return [...strongest, ...sample];
}

const TTL_MS = 30 * 60_000;
let held: { at: number; rows: FireRow[]; source: string } | null = null;
let inflight: Promise<{ rows: FireRow[]; source: string }> | null = null;

async function csv(url: string): Promise<FireRow[]> {
  const text = await httpText(url, { timeoutMs: 45_000, headers: { Accept: 'text/csv' } });
  return text.includes('latitude') ? parseFirmsCsv(text) : [];
}

/** The merged hotspots, cached for 30 minutes (each file is about 9 MB); the last good copy on failure. */
export function loadFirms(): Promise<{ rows: FireRow[]; source: string }> {
  if (held && Date.now() - held.at < TTL_MS) return Promise.resolve(held);
  inflight ??= (async () => {
    try {
      const results = await Promise.allSettled(FIRMS_VIIRS.map(s => csv(s.url)));
      const answered = FIRMS_VIIRS.filter((_, i) => results[i].status === 'fulfilled' && (results[i] as PromiseFulfilledResult<FireRow[]>).value.length);
      let rows = mergeDetections(results.flatMap(r => (r.status === 'fulfilled' ? [r.value] : [])));
      let source = `NASA-FIRMS (VIIRS ${answered.map(s => s.satellite).join(', ')})`;
      if (!rows.length) {
        rows = mergeDetections([await csv(FIRMS_MODIS)]);
        source = 'NASA-FIRMS (MODIS)';
      }
      if (rows.length) held = { at: Date.now(), rows, source };
    } catch (e) {
      console.warn('[TAKIP] FIRMS failed:', e instanceof Error ? e.message : e);
    } finally {
      inflight = null;
    }
    return held ?? { rows: [], source: '' };
  })();
  return inflight;
}
