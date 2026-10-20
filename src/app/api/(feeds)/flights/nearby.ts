import { ADSBLOL_BASE, adsbLolBusy, getAc } from './adsb-lol';
import { classifyFlight } from './classify';

/*
 * Near-real-time aircraft around the view: adsb.lol's radius query, a few seconds old, where the global
 * snapshot is 90 s old or more. Anchors snap to a 0.25° grid so nearby views share one read, and reads
 * are spaced across all anchors, because adsb.lol refuses a fourth request inside about 5 s.
 */

/** adsb.lol's radius cap, in nautical miles. */
export const NEARBY_NM = 250;
const SNAP_DEG = 0.25;
// Under the open card's 10 s poll, so each of its reads is a new one; GAP_MS is what spares adsb.lol.
const TTL_MS = 9_000;
const GAP_MS = 5_000;
const COOLDOWN_MS = 30_000;
const MAX_ANCHORS = 64;

export type NearbyRow = NonNullable<ReturnType<typeof classifyFlight>>;
export interface Anchor { lat: number; lon: number }

export function snapAnchor(lat: number, lon: number): Anchor {
  const snap = (v: number) => Math.round(v / SNAP_DEG) * SNAP_DEG;
  const wrapped = ((((lon + 180) % 360) + 360) % 360) - 180;
  return { lat: Math.max(-85, Math.min(85, snap(lat))), lon: snap(wrapped) === 180 ? -180 : snap(wrapped) };
}

export const nearbyUrl = (a: Anchor) => `${ADSBLOL_BASE}/lat/${a.lat}/lon/${a.lon}/dist/${NEARBY_NM}`;

interface State {
  entries: Map<string, { at: number; rows: NearbyRow[] }>;
  inflight: Map<string, Promise<void>>;
  lastCall: number;
  cooldownUntil: number;
}
// On globalThis, like adsb-lol.ts: dev reloads would otherwise each keep their own spacing.
const holder = globalThis as unknown as { takipAdsbLolNearby?: State };
const state = (): State => (holder.takipAdsbLolNearby ??= { entries: new Map(), inflight: new Map(), lastCall: 0, cooldownUntil: 0 });

export interface Nearby { anchor: Anchor; rows: NearbyRow[]; at: number | null; stale: boolean }

async function read(key: string, anchor: Anchor) {
  const st = state();
  st.lastCall = Date.now();
  const { status, ac, retryAfter } = await getAc(nearbyUrl(anchor), 10_000);
  if (status === 429) st.cooldownUntil = Date.now() + Math.max(retryAfter ?? 0, COOLDOWN_MS);
  if (!ac) return;
  st.entries.delete(key);
  st.entries.set(key, { at: Date.now(), rows: ac.map(classifyFlight).filter((r): r is NearbyRow => r !== null) });
  // Map order is insertion order, so the first key is the least recently read.
  while (st.entries.size > MAX_ANCHORS) st.entries.delete(st.entries.keys().next().value!);
}

/** The aircraft within 250 nm of the anchor nearest (lat, lon); the last read, marked stale, while reads must wait. */
export async function loadNearby(lat: number, lon: number, now = Date.now()): Promise<Nearby> {
  const st = state();
  const anchor = snapAnchor(lat, lon);
  const key = `${anchor.lat},${anchor.lon}`;
  const answer = (): Nearby => {
    const e = st.entries.get(key);
    return { anchor, rows: e?.rows ?? [], at: e?.at ?? null, stale: !e || Date.now() - e.at >= TTL_MS };
  };
  const held = st.entries.get(key);
  if (held && now - held.at < TTL_MS) return answer();
  const pending = st.inflight.get(key);
  if (pending) {
    await pending;
    return answer();
  }
  if (adsbLolBusy(now) || now < st.cooldownUntil || now - st.lastCall < GAP_MS) return answer();
  const p = read(key, anchor).finally(() => st.inflight.delete(key));
  st.inflight.set(key, p);
  await p;
  return answer();
}

/** Test seam. */
export function resetNearby(): void {
  holder.takipAdsbLolNearby = undefined;
}
