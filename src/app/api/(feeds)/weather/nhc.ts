/**
 * TAKIP — active tropical cyclones from NOAA's National Hurricane Center (CurrentStorms.json), no key.
 * Atlantic, Eastern and Central Pacific only: an empty West Pacific means JTWC/JMA basins are out of scope.
 * `{ activeStorms: [] }` is a normal answer for months of the year, not an outage.
 * The pin is the storm centre, not the forecast cone. US public domain.
 */

export const NHC_URL = 'https://www.nhc.noaa.gov/CurrentStorms.json';

export interface NhcStorm {
  id?: string;
  binNumber?: string;
  name?: string;
  classification?: string;
  intensity?: string | number;
  pressure?: string | number;
  latitudeNumeric?: number;
  longitudeNumeric?: number;
  movementDir?: number;
  movementSpeed?: number;
  lastUpdate?: string;
  publicAdvisory?: { url?: string } | null;
  forecastGraphics?: { url?: string } | null;
}

export interface NhcEvent {
  id: string;
  title: string;
  category: 'tropicalCyclone';
  type: string;
  icon: 'cyclone';
  severity: 'low' | 'medium' | 'high';
  lat: number;
  lng: number;
  date?: string;
  area?: string;
  source: string;
  provider: 'NOAA/NHC';
}

const CLASSES: Record<string, string> = {
  TD: 'Tropical Depression',
  STD: 'Subtropical Depression',
  TS: 'Tropical Storm',
  STS: 'Subtropical Storm',
  HU: 'Hurricane',
  TY: 'Typhoon',
  PTC: 'Post-Tropical Cyclone',
  PC: 'Potential Tropical Cyclone',
};

const BASINS: Record<string, string> = { AT: 'Atlantic', EP: 'Eastern Pacific', CP: 'Central Pacific' };

const COMPASS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];

function num(value: unknown): number | null {
  const n = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : NaN;
  return Number.isFinite(n) ? n : null;
}

/** Saffir-Simpson category from sustained wind in knots. */
export function hurricaneCategory(knots: number): number {
  if (knots >= 137) return 5;
  if (knots >= 113) return 4;
  if (knots >= 96) return 3;
  if (knots >= 83) return 2;
  return 1;
}

export function mapNhcStorm(s: NhcStorm | null | undefined): NhcEvent | null {
  if (!s?.id) return null;
  const lat = num(s.latitudeNumeric);
  const lng = num(s.longitudeNumeric);
  if (lat == null || lng == null || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;

  const code = (s.classification ?? '').toUpperCase();
  const kind = CLASSES[code] ?? 'Tropical Cyclone';
  const knots = num(s.intensity);
  const pressure = num(s.pressure);
  const isHurricane = code === 'HU' || code === 'TY';
  const category = isHurricane && knots != null ? hurricaneCategory(knots) : null;
  const type = category ? `${kind} (Category ${category})` : kind;

  const details = [
    knots != null ? `${knots} kt` : null,
    pressure != null ? `${pressure} mb` : null,
    s.movementSpeed != null && s.movementDir != null
      ? `moving ${COMPASS[Math.round(((s.movementDir % 360) + 360) % 360 / 22.5) % 16]} at ${s.movementSpeed} kt`
      : null,
  ].filter(Boolean).join(', ');

  return {
    id: `nhc-${s.id}`,
    title: `${kind} ${s.name ?? s.id}${category ? `, Category ${category}` : ''}${details ? ` — ${details}` : ''}`,
    category: 'tropicalCyclone',
    type,
    icon: 'cyclone',
    severity: isHurricane ? 'high' : code === 'TS' || code === 'STS' ? 'medium' : 'low',
    lat,
    lng,
    date: s.lastUpdate,
    area: BASINS[(s.binNumber ?? '').slice(0, 2).toUpperCase()],
    source: s.forecastGraphics?.url || s.publicAdvisory?.url || 'https://www.nhc.noaa.gov/',
    provider: 'NOAA/NHC',
  };
}

export function parseNhcStorms(json: unknown): NhcEvent[] {
  const storms = (json as { activeStorms?: unknown } | null)?.activeStorms;
  if (!Array.isArray(storms)) throw new Error('NHC: unexpected CurrentStorms.json shape');
  return storms.map(s => mapNhcStorm(s as NhcStorm)).filter((e): e is NhcEvent => e !== null);
}
