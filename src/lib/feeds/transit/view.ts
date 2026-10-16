/** What the transit layer and /api/transit share. The feed catalogue stays server-side. */
import type { TransitMode } from './modes';

/** The layer draws and fetches from this zoom in: a city, not a country. */
export const TRANSIT_MIN_ZOOM = 10;

/** The widest view /api/transit serves, in degrees; a tilted map's horizon is cut down to this around the centre. */
export const TRANSIT_MAX_SPAN = { lng: 3, lat: 2 } as const;

/** Polling interval while the layer is on and zoomed in. */
export const TRANSIT_REFRESH_MS = 20_000;

/** Polling interval for a vehicle with its window open; the server refetches a feed at most every 15 s. */
export const TRANSIT_TRACK_MS = 10_000;

/** [west, south, east, north] */
export type Bbox = [number, number, number, number];

export interface TransitVehicle {
  /** `${feed id}:${vehicle id}`: vehicle ids are only unique within a feed. */
  key: string;
  /** Index into TransitResponse.feeds. */
  feed: number;
  lng: number;
  lat: number;
  bearing?: number;
  /** Metres per second. */
  speed?: number;
  route?: string;
  /** The trip it is running, for its route shape. */
  trip?: string;
  label?: string;
  plate?: string;
  operator?: string;
  status?: number;
  /** Seconds since the vehicle last reported, when known. */
  age?: number;
  mode?: TransitMode;
  /** Placed from its stops (a train underground has no GPS): the stop it is at or heading to, and the one it left. */
  stop?: string;
  from?: string;
  estimated?: boolean;
  /** Run from the timetable, not live: the system publishes no positions or predictions. */
  scheduled?: boolean;
}

export interface TransitFeedInfo {
  id: string;
  name: string;
  license?: string;
  /** False when the feed failed and nothing recent was cached. */
  ok: boolean;
  count: number;
}

export interface TransitResponse {
  feeds: TransitFeedInfo[];
  vehicles: TransitVehicle[];
  /** Feeds in view that were left out by the per-request cap. */
  skipped: number;
  tooWide?: boolean;
  timestamp: string;
}

const wrapLng = (lng: number) => ((((lng + 180) % 360) + 360) % 360) - 180;

/**
 * A view within TRANSIT_MAX_SPAN: an axis that is too wide is cut to the span around `center`
 * (a tilted map's bounds run off to the horizon, away from where the user looks). Longitudes wrap into [-180, 180].
 */
export function clampView([w, s, e, n]: Bbox, center: [number, number] = [(w + e) / 2, (s + n) / 2]): Bbox {
  const axis = (lo: number, hi: number, c: number, max: number) => (hi - lo <= max ? [lo, hi] : [c - max / 2, c + max / 2]);
  const [x0, x1] = axis(w, e, center[0], TRANSIT_MAX_SPAN.lng);
  const [y0, y1] = axis(s, n, center[1], TRANSIT_MAX_SPAN.lat);
  const shift = wrapLng((x0 + x1) / 2) - (x0 + x1) / 2;
  const r = (v: number) => Math.round(v * 1000) / 1000;
  return [r(x0 + shift), r(Math.max(-85, y0)), r(x1 + shift), r(Math.min(85, y1))];
}

export function parseBbox(raw: string | null): Bbox | null {
  const parts = raw?.split(',').map(Number);
  if (!parts || parts.length !== 4 || !parts.every(Number.isFinite)) return null;
  const [w, s, e, n] = parts;
  if (w >= e || s >= n || s < -90 || n > 90 || w < -540 || e > 540) return null;
  return [w, s, e, n];
}

export const isTooWide = ([w, s, e, n]: Bbox) => e - w > TRANSIT_MAX_SPAN.lng * 1.01 || n - s > TRANSIT_MAX_SPAN.lat * 1.01;
