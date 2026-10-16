/** What the traffic layer and /api/traffic share. Upstreams and their parsing stay server-side. */

/** The layer fetches and draws from this zoom in: a city, not a country. */
export const TRAFFIC_MIN_ZOOM = 10;

/** The widest view /api/traffic serves, in degrees; a tilted map's horizon is cut down to this around the centre. */
export const TRAFFIC_MAX_SPAN = { lng: 3, lat: 2 } as const;

export const TRAFFIC_REFRESH_MS = 2 * 60_000;

/** [west, south, east, north] */
export type Bbox = [number, number, number, number];

/** Only roads running below their usual or reported as congested are sent; free-flowing ones get no tint. */
export type TrafficLevel = 'slow' | 'jam';

export type TrafficSourceId = 'ndw' | 'rennes' | 'nantes';

/** One measured stretch of road, in the shape every provider is brought to. */
export interface TrafficSegment {
  /** `${source}:${provider's segment id}` */
  id: string;
  source: TrafficSourceId;
  level: TrafficLevel;
  /** In the direction of travel, so the tint can sit on the right-hand side of the road. */
  coords: [number, number][];
  /** When the provider measured it (ISO). */
  at: string;
  kmh?: number;
  /** Speed as a percentage of the provider's usual for this road and time; only NDW publishes one. */
  pctOfUsual?: number;
  /** The provider's own class word ("heavy", "Saturé"), shown as given. */
  status?: string;
  name?: string;
}

export interface TrafficResponse {
  segments: TrafficSegment[];
  /** Providers covering the view, and whether each answered. */
  sources: { id: TrafficSourceId; ok: boolean }[];
  /** TomTom flow tiles (/api/traffic/flow) are configured, so every covered road can be tinted. */
  flow: boolean;
  tooWide?: boolean;
  timestamp: string;
}

const wrapLng = (lng: number) => ((((lng + 180) % 360) + 360) % 360) - 180;

/** A view within TRAFFIC_MAX_SPAN, cut around `center` on an axis that is too wide. */
export function clampView([w, s, e, n]: Bbox, center: [number, number] = [(w + e) / 2, (s + n) / 2]): Bbox {
  const axis = (lo: number, hi: number, c: number, max: number) => (hi - lo <= max ? [lo, hi] : [c - max / 2, c + max / 2]);
  const [x0, x1] = axis(w, e, center[0], TRAFFIC_MAX_SPAN.lng);
  const [y0, y1] = axis(s, n, center[1], TRAFFIC_MAX_SPAN.lat);
  const shift = wrapLng((x0 + x1) / 2) - (x0 + x1) / 2;
  const r = (v: number) => Math.round(v * 1000) / 1000;
  return [r(x0 + shift), r(Math.max(-85, y0)), r(x1 + shift), r(Math.min(85, y1))];
}

export function parseBbox(raw: string | null): Bbox | null {
  const parts = raw?.split(',').map(Number);
  if (!parts || parts.length !== 4 || !parts.every(Number.isFinite)) return null;
  const [w, s, e, n] = parts;
  if (w >= e || s >= n || s < -90 || n > 90 || w < -180 || e > 180) return null;
  return [w, s, e, n];
}

export const isTooWide = ([w, s, e, n]: Bbox) => e - w > TRAFFIC_MAX_SPAN.lng * 1.01 || n - s > TRAFFIC_MAX_SPAN.lat * 1.01;

export const intersects = (a: Bbox, b: Bbox) => a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1];

export function bboxOf(coords: [number, number][]): Bbox {
  let w = Infinity, s = Infinity, e = -Infinity, n = -Infinity;
  for (const [x, y] of coords) {
    if (x < w) w = x;
    if (x > e) e = x;
    if (y < s) s = y;
    if (y > n) n = y;
  }
  return [w, s, e, n];
}

/** NDW's percentage of usual speed, in the two tints; at or above SLOW it is not drawn. */
export const PCT_SLOW = 65;
export const PCT_JAM = 40;

export const levelFromPct = (pct: number): TrafficLevel | null => (pct < PCT_JAM ? 'jam' : pct < PCT_SLOW ? 'slow' : null);
