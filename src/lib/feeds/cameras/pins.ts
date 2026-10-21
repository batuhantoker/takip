/**
 * The map's camera layer needs only where each camera is: 106,000 full records are 30 MB of JSON, their pins
 * under 1 MB gzipped. Names and URLs come per camera from /api/cctv/details when one is opened, hovered or
 * previewed (camera-details.ts).
 *
 * Columns, not objects: one array per field, sorted by source then id. Each id is stored as what differs from
 * the one before (`ids`) after the characters they share (`shared`), and each coordinate as integer steps of
 * 1e-5° (about a metre) from the previous camera's, so gzip finds the repetition.
 */

export interface CameraPin {
  id: string;
  lat: number;
  lng: number;
  source: string;
  offline?: true;
}

export interface PinColumns {
  format: 'pins';
  sources: string[];
  /** Each id without the leading characters it shares with the previous one. */
  ids: string[];
  /** How many leading characters each id shares with the previous one. */
  shared: number[];
  /** Index into `sources`, per camera. */
  source: number[];
  /** Delta-coded, in SCALE steps. */
  lat: number[];
  lng: number[];
  /** Indexes of cameras that are off air. */
  offline: number[];
}

const SCALE = 1e5;

/** The most cameras one /api/cctv/details request answers for. */
export const DETAILS_MAX_IDS = 100;

type Raw = { id?: unknown; lat?: unknown; lng?: unknown; source?: unknown; offline?: unknown };

export function encodePins(cameras: readonly Raw[]): PinColumns {
  const rows = cameras
    .map(c => ({ id: String(c.id ?? ''), lat: Number(c.lat), lng: Number(c.lng), source: String(c.source ?? ''), offline: c.offline === true }))
    .filter(c => c.id && Number.isFinite(c.lat) && Number.isFinite(c.lng))
    .sort((a, b) => (a.source < b.source ? -1 : a.source > b.source ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const sources: string[] = [];
  const sourceIndex = new Map<string, number>();
  const out: PinColumns = { format: 'pins', sources, ids: [], shared: [], source: [], lat: [], lng: [], offline: [] };
  let lat = 0, lng = 0, previous = '';
  rows.forEach((c, i) => {
    let s = sourceIndex.get(c.source);
    if (s === undefined) { s = sources.push(c.source) - 1; sourceIndex.set(c.source, s); }
    const qLat = Math.round(c.lat * SCALE), qLng = Math.round(c.lng * SCALE);
    let n = 0;
    while (n < previous.length && n < c.id.length && previous[n] === c.id[n]) n++;
    out.shared.push(n);
    out.ids.push(c.id.slice(n));
    previous = c.id;
    out.source.push(s);
    out.lat.push(qLat - lat);
    out.lng.push(qLng - lng);
    lat = qLat; lng = qLng;
    if (c.offline) out.offline.push(i);
  });
  return out;
}

export function isPinColumns(v: unknown): v is PinColumns {
  const p = v as PinColumns | null;
  return !!p && p.format === 'pins' && Array.isArray(p.ids) && Array.isArray(p.shared) && Array.isArray(p.lat) && Array.isArray(p.lng)
    && Array.isArray(p.source) && Array.isArray(p.sources)
    && [p.shared, p.lat, p.lng, p.source].every(column => column.length === p.ids.length);
}

export function decodePins(p: PinColumns): CameraPin[] {
  const off = new Set(p.offline ?? []);
  const out: CameraPin[] = new Array(p.ids.length);
  let lat = 0, lng = 0, previous = '';
  for (let i = 0; i < p.ids.length; i++) {
    lat += p.lat[i];
    lng += p.lng[i];
    previous = previous.slice(0, p.shared[i]) + p.ids[i];
    const pin: CameraPin = { id: previous, lat: lat / SCALE, lng: lng / SCALE, source: p.sources[p.source[i]] ?? '' };
    if (off.has(i)) pin.offline = true;
    out[i] = pin;
  }
  return out;
}
