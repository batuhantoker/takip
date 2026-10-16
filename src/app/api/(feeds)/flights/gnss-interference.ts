/**
 * TAKIP — likely GNSS interference, inferred from aircraft that report degraded position accuracy (NACp).
 * gpsjam.org's method on our own ADS-B: share of airborne aircraft in a cell reporting bad accuracy, kept only
 * where enough aircraft fly to make a share meaningful. Receiver gaps and avionics faults look the same, it
 * can't tell jamming from spoofing or locate the source, and no aircraft means no data.
 */

export interface NavSample { lat: number; lng: number; nac_p: number }

export interface InterferenceCell {
  /** Cell centre. */
  lat: number;
  lng: number;
  /** Cell size in degrees, so the map can draw the area rather than a point. */
  size: number;
  bad: number;
  total: number;
  ratio: number;
  /** 0–100, kept for older readers of `gps_jamming`. */
  severity: number;
  count: number;
}

// A single poll sees far fewer aircraft than gpsjam's daily files, so one or two faulty transponders are not enough.
type RawRow = { hex?: unknown; lat?: unknown; lon?: unknown; nac_p?: unknown; alt_baro?: unknown };

/** Airborne tar1090 rows that carry their own accuracy, once per aircraft. OpenSky rows carry no NACp. */
export function navSamplesFrom(rows: unknown[]): NavSample[] {
  const seen = new Set<string>();
  const out: NavSample[] = [];
  for (const r of rows as RawRow[]) {
    if (typeof r?.nac_p !== 'number' || typeof r.lat !== 'number' || typeof r.lon !== 'number') continue;
    if (r.alt_baro === 'ground' || (typeof r.alt_baro === 'number' && r.alt_baro < 100)) continue;
    const hex = String(r.hex ?? '').toLowerCase().trim();
    if (!hex || seen.has(hex)) continue;
    seen.add(hex);
    out.push({ lat: r.lat, lng: r.lon, nac_p: r.nac_p });
  }
  return out;
}

export const INTERFERENCE_RULE = { gridDeg: 2, badNacp: 4, minAircraft: 10, minRatio: 0.1, minBad: 3 };

export function interferenceCells(samples: NavSample[], rule = INTERFERENCE_RULE): InterferenceCell[] {
  const cells = new Map<string, { lat: number; lng: number; bad: number; total: number }>();
  const g = rule.gridDeg;
  for (const s of samples) {
    if (!Number.isFinite(s.lat) || !Number.isFinite(s.lng) || !Number.isFinite(s.nac_p)) continue;
    const lat = Math.floor(s.lat / g) * g;
    const lng = Math.floor(s.lng / g) * g;
    const key = `${lat},${lng}`;
    const cell = cells.get(key) ?? { lat: lat + g / 2, lng: lng + g / 2, bad: 0, total: 0 };
    cell.total++;
    if (s.nac_p <= rule.badNacp) cell.bad++;
    cells.set(key, cell);
  }
  return [...cells.values()]
    .filter(c => c.total >= rule.minAircraft && c.bad >= rule.minBad && c.bad / c.total >= rule.minRatio)
    .map(c => {
      const ratio = Math.round((c.bad / c.total) * 1000) / 1000;
      return { lat: c.lat, lng: c.lng, size: g, bad: c.bad, total: c.total, ratio, severity: Math.round(ratio * 100), count: c.bad };
    })
    .sort((a, b) => b.ratio - a.ratio);
}
