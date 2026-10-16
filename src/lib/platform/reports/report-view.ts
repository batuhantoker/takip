import { APP_VERSION } from '@/lib/platform/app-version';
import type { HistorySession } from '@/lib/history/session';
import { viewPath } from '@/lib/map/view-link';
import { formatMa, maAt } from '@/lib/history/paleo/deep-time';
import type { ReplaySession } from '@/lib/map/replay/session';

type LatLng = { lat: number; lng: number };

/** A report's snapshot of the reporter's map; mirrors ReportView in apps/api/src/reports/schemas.ts. */
export type ReportView = {
  /** A path on this site that reopens the view. */
  link?: string;
  center?: LatLng;
  zoom?: number;
  bearing?: number;
  pitch?: number;
  mode?: 'live' | 'replay' | 'history';
  /** ISO 8601 in Replay and History, or "250.0 Ma" in deep time. */
  time?: string;
  /** Where the space view is looking, while it is open. */
  space?: string;
  /** What the map follows, as a share link names it: `aircraft:4bb1c2`. */
  track?: string;
  baseMap?: string;
  projection?: string;
  theme?: string;
  layers?: string[];
  panel?: string | null;
  /** Where the reporter right-clicked. */
  point?: LatLng;
  viewport?: { width: number; height: number };
  version?: string;
};

export type ReportMode = { kind: 'live' } | { kind: 'replay'; at: number } | { kind: 'history'; at: number } | { kind: 'deep'; ma: number };

/** What the page knows about its map when a report is sent. */
export type ViewInputs = {
  center: LatLng | null;
  zoom: number;
  layers: Record<string, boolean>;
  mode: ReportMode;
  space: string | null;
  track: string | null;
  baseMap: string;
  projection: string;
  theme: string;
  panel: string | null;
};

/** The map container's own record of its settled camera (bind-view-events.ts writes it as data-map-camera). */
export type MapCamera = { zoom?: number; pitch?: number; bearing?: number; lat?: number; lng?: number };

export function reportMode(replay: ReplaySession | null, history: HistorySession | null): ReportMode {
  if (replay) return { kind: 'replay', at: replay.clock.time() };
  if (history) return history.deep() ? { kind: 'deep', ma: maAt(history.deepClock.time()) } : { kind: 'history', at: history.clock.time() };
  return { kind: 'live' };
}

const round = (value: number, places: number) => Math.round(value * 10 ** places) / 10 ** places;
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

function isoOrNothing(ms: number) {
  try {
    return new Date(ms).toISOString();
  } catch {
    return undefined;
  }
}

function timeOf(mode: ReportMode) {
  if (mode.kind === 'live') return undefined;
  return mode.kind === 'deep' ? formatMa(mode.ma) : isoOrNothing(mode.at);
}

/**
 * The snapshot a report carries. The camera, when the map has written one, is fresher than the page's state;
 * `fallbackLink` (the page's own path) stands in when the map has no centre yet.
 */
export function buildReportView(inputs: ViewInputs, { camera, viewport, point, fallbackLink }: {
  camera?: MapCamera | null;
  viewport?: { width: number; height: number };
  point?: LatLng | null;
  fallbackLink?: string;
} = {}): ReportView {
  const cam = camera ?? {};
  const center = finite(cam.lat) && finite(cam.lng) ? { lat: cam.lat, lng: cam.lng } : inputs.center;
  const zoom = finite(cam.zoom) ? cam.zoom : inputs.zoom;
  const link = center ? viewPath({ lat: center.lat, lng: center.lng, zoom, layers: inputs.layers, track: inputs.track }) : fallbackLink;
  const time = timeOf(inputs.mode);
  return {
    ...(link && { link }),
    ...(center && { center: { lat: round(center.lat, 5), lng: round(center.lng, 5) } }),
    zoom: round(zoom, 2),
    ...(finite(cam.bearing) && { bearing: round(cam.bearing, 1) }),
    ...(finite(cam.pitch) && { pitch: round(cam.pitch, 1) }),
    mode: inputs.mode.kind === 'deep' ? 'history' : inputs.mode.kind,
    ...(time && { time }),
    ...(inputs.space && { space: inputs.space }),
    ...(inputs.track && { track: inputs.track }),
    baseMap: inputs.baseMap,
    projection: inputs.projection,
    theme: inputs.theme,
    layers: Object.entries(inputs.layers).filter(([, on]) => on).map(([key]) => key),
    panel: inputs.panel,
    ...(point && { point: { lat: round(point.lat, 5), lng: round(point.lng, 5) } }),
    ...(viewport && { viewport }),
    version: APP_VERSION,
  };
}
