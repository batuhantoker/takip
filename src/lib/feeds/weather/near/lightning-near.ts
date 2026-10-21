import { LIGHTNING_SOURCES, lightningImage, lightningTimes, type LightningSource, type LightningSourceId } from '../lightning';
import { degreeBox, fetchPixels, heldPromises, nearestDrawn, throttle, type Hit, type Pixels } from './pixels';

/**
 * Lightning near a point in the last 15 minutes, from both networks' pictures (../lightning.ts). Points in the same
 * 1° cell share one picture per frame, so a city's visitors and its page cost one request between them.
 */

export const LIGHTNING_RADIUS_KM = 50;
export const LIGHTNING_WINDOW_MS = 15 * 60_000;

export type LightningNow =
  | { covered: false }
  /** `at` is the newest frame read; `nearest` the closest strike or flash within the radius. */
  | { covered: true; at: number; nearest: Hit | null; sources: LightningSourceId[] };

/** A network whose newest frame is older than this has stalled, and saying "none" from it would mislead. */
const STALE_MS = 60 * 60_000;
const TIMES_TTL_MS = 2 * 60_000;
/** About 55 km around the cell, so every point in it has its whole radius in the picture. */
const MARGIN_DEG = 0.5;
const PX_PER_DEG = 111;

const wait = throttle(8);
const pictures = heldPromises<Pixels | null>(2000);
const timesHeld = new Map<LightningSourceId, { at: number; times: Promise<number[]> }>();

function framesOf(source: LightningSource): Promise<number[]> {
  const held = timesHeld.get(source.id);
  if (held && Date.now() - held.at < TIMES_TTL_MS) return held.times;
  const times = lightningTimes(source, AbortSignal.timeout(8_000)).catch(() => held?.times ?? []);
  timesHeld.set(source.id, { at: Date.now(), times });
  return times;
}

function cellBox([lng, lat]: [number, number]): [number, number, number, number] {
  const [w, s] = [Math.floor(lng), Math.floor(lat)];
  const dLng = MARGIN_DEG / Math.max(0.2, Math.cos(Math.min(85, Math.max(Math.abs(s), Math.abs(s + 1))) * (Math.PI / 180)));
  return [Math.max(-180, w - dLng), Math.max(-85, s - MARGIN_DEG), Math.min(180, w + 1 + dLng), Math.min(85, s + 1 + MARGIN_DEG)];
}

function picture(source: LightningSource, time: number, box: [number, number, number, number]): Promise<Pixels | null> {
  const mid = ((box[1] + box[3]) / 2) * (Math.PI / 180);
  const width = Math.round((box[2] - box[0]) * PX_PER_DEG * Math.cos(mid));
  const height = Math.round((box[3] - box[1]) * PX_PER_DEG);
  return pictures(`${source.id}:${time}:${box.join(',')}`,
    () => wait().then(() => fetchPixels(lightningImage(source, time, box, width, height), AbortSignal.timeout(8_000))));
}

/** What reaches the point's radius: the box's corners as well, where the networks meet at 0°. */
function sourcesFor(at: [number, number]): LightningSource[] {
  const [w, s, e, n] = cellBox(at);
  const probes: [number, number][] = [at, [w, s], [w, n], [e, s], [e, n]];
  return LIGHTNING_SOURCES.filter(src => probes.some(p => src.covers(p)));
}

/** Null when no network could be read just now (the caller leaves the answer out). */
export async function lightningNear(at: [number, number], now = Date.now()): Promise<LightningNow | null> {
  if (!LIGHTNING_SOURCES.some(s => s.covers(at))) return { covered: false };
  const sources = sourcesFor(at);
  const box = cellBox(at);
  const read = await Promise.all(sources.map(async source => {
    const times = await framesOf(source);
    const newest = times.at(-1);
    if (newest == null || now - newest > STALE_MS) return null;
    const frames = times.filter(t => t > newest - LIGHTNING_WINDOW_MS);
    const shots = await Promise.all(frames.map(t => picture(source, t, box).catch(() => null)));
    if (shots.some(p => !p)) return null;
    const hits = shots.map(p => nearestDrawn(p!, at, LIGHTNING_RADIUS_KM, degreeBox(box, p!.width, p!.height)));
    return { id: source.id, at: newest, nearest: hits.reduce<Hit | null>((a, b) => (b && (!a || b.km < a.km) ? b : a), null) };
  }));
  const ok = read.filter(r => r !== null);
  // A neighbour's picture alone can't say there is none over the point.
  if (sources.some((s, i) => s.covers(at) && !read[i])) return null;
  return {
    covered: true,
    at: Math.max(...ok.map(r => r.at)),
    nearest: ok.map(r => r.nearest).reduce<Hit | null>((a, b) => (b && (!a || b.km < a.km) ? b : a), null),
    sources: ok.map(r => r.id),
  };
}
