import { TAKIP_USER_AGENT } from '@/lib/core/net/user-agent';
import { tomtomFlowUrl } from './sources/tomtom';
import { TRAFFIC_REFRESH_MS } from './types';

/** TomTom's free allowance is 200,000 flow tiles a month; this keeps a day well inside it. */
export const FLOW_TILES_PER_DAY = 6_000;
const MAX_CACHED = 600;
const TIMEOUT_MS = 15_000;

export const flowKey = () => process.env.TOMTOM_API_KEY?.trim() || null;

type FetchTile = (url: string) => Promise<Response>;

interface Options { fetchTile?: FetchTile; now?: () => number; perDay?: number }

/**
 * Flow tiles shared by every viewer for one refresh period, under a daily budget.
 * The budget is per server process; a restart starts the day again.
 */
export function createFlowTiles(key: string, { fetchTile = defaultFetch, now = Date.now, perDay = FLOW_TILES_PER_DAY }: Options = {}) {
  const cache = new Map<string, { at: number; tile: Promise<ArrayBuffer | null> }>();
  let day = '';
  let used = 0;

  return function flowTile(z: number, x: number, y: number): Promise<ArrayBuffer | null> {
    const id = `${z}/${x}/${y}`;
    const hit = cache.get(id);
    if (hit && now() - hit.at < TRAFFIC_REFRESH_MS) return hit.tile;
    const today = new Date(now()).toISOString().slice(0, 10);
    if (today !== day) { day = today; used = 0; }
    if (used >= perDay) return Promise.resolve(null);
    used++;
    const tile = fetchTile(tomtomFlowUrl(z, x, y, key))
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.arrayBuffer();
      })
      .catch((e: unknown) => {
        console.warn(`[TAKIP] traffic: TomTom flow tile ${id}:`, e instanceof Error ? e.message : e);
        return null;
      });
    cache.delete(id);
    cache.set(id, { at: now(), tile });
    if (cache.size > MAX_CACHED) cache.delete(cache.keys().next().value!);
    return tile;
  };
}

const defaultFetch: FetchTile = url =>
  fetch(url, { headers: { 'User-Agent': TAKIP_USER_AGENT }, signal: AbortSignal.timeout(TIMEOUT_MS), cache: 'no-store' });
