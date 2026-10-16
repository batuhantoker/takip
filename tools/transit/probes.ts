import type { RtStopFix, RtVehicle } from '../../src/lib/feeds/transit/gtfs/realtime';
import { stopFixes } from '../../src/lib/feeds/transit/placement/stop-place';
import { fetchFeed } from '../../src/lib/feeds/transit/upstream';
import type { Bbox } from '../../src/lib/feeds/transit/view';
import type { Candidate } from './catalogue';

export const TIMEOUT_MS = 20_000;
const PAD = 0.03;
const STRAY_MIN_DEG = 0.5;

export interface Probe { vehicles?: RtVehicle[]; atStops?: RtStopFix[]; err?: string; fatal?: boolean; at?: number }

/** As /api/transit: an older position is history (Entur keeps vehicles from hours ago). */
const MAX_AGE_S = 30 * 60;
export const recent = <T extends { t?: number }>(p: Probe, xs: T[] | undefined) => (xs ?? []).filter(v => !v.t || (p.at ?? Date.now()) / 1000 - v.t < MAX_AGE_S);
export const fresh = (p: Probe) => recent(p, p.vehicles);

export async function probe(c: Candidate): Promise<Probe> {
  try {
    const m = await fetchFeed({ id: c.id, kind: 'gtfs-rt', url: c.url }, AbortSignal.timeout(TIMEOUT_MS));
    const atStops = stopFixes(m, Date.now() / 1000);
    return { vehicles: m.vehicles, atStops: atStops.length ? atStops : undefined, at: Date.now() };
  } catch (e) {
    const err = String((e as { cause?: { code?: string } }).cause?.code ?? (e as Error).message ?? e);
    // A busy server may answer next time; a 404, a dead host, a bad certificate or a non-feed body won't.
    const fatal = /HTTP 4\d\d|ENOTFOUND|CERT|GTFS-RT|Invalid URL/i.test(err);
    return { err, fatal };
  }
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};

/**
 * Where the probed vehicles are. A fix far from the rest (a bus reporting from another continent) is dropped:
 * the cut is 8 median deviations out, and never closer than STRAY_MIN_DEG so a small town keeps its outskirts.
 */
export function vehicleBbox(vs: RtVehicle[]): Bbox | undefined {
  if (!vs.length) return undefined;
  const keep = (vals: number[]) => {
    const m = median(vals);
    const cut = Math.max(8 * median(vals.map(v => Math.abs(v - m))), STRAY_MIN_DEG);
    return (v: number) => Math.abs(v - m) <= cut;
  };
  const okLng = keep(vs.map(v => v.lng)), okLat = keep(vs.map(v => v.lat));
  const kept = vs.filter(v => okLng(v.lng) && okLat(v.lat));
  const lng = kept.map(v => v.lng), lat = kept.map(v => v.lat);
  return [Math.min(...lng), Math.min(...lat), Math.max(...lng), Math.max(...lat)];
}

export const span = ([w, s, e, n]: Bbox) => Math.max(e - w, n - s);
export const pad = ([w, s, e, n]: Bbox): Bbox => [w - PAD, s - PAD, e + PAD, n + PAD].map(v => Math.round(v * 1000) / 1000) as Bbox;
export const meets = (a: Bbox, b: Bbox) => a[0] <= b[2] && b[0] <= a[2] && a[1] <= b[3] && b[1] <= a[3];
export const union = (a: Bbox, b: Bbox): Bbox => [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])];

export function jaccard(a: Set<string>, b: Set<string>) {
  let both = 0;
  for (const x of a) if (b.has(x)) both++;
  return both / (a.size + b.size - both);
}
