import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'fs';
import { join } from 'path';
import { historyDue, type CraftHistory } from '@/lib/space/replay/flight-history';
import { jdFromMs } from '@/lib/space/horizons';
import type { Lane } from '../horizons-fetch';
import { collectHistory } from './collect';

/**
 * TAKIP — every flight fetched so far, kept on disk so a replay opens at once
 * and a restart asks Horizons nothing. An ended flight is fetched once; a live
 * one is refetched in the background when its prediction ages, never while
 * someone waits for it.
 */

/** Bump when the `CraftHistory` shape changes; files of older versions are then ignored. */
const VERSION = 7;
/** Behind a replay, a live flight is refetched for next time once its prediction is this old. */
const REPLAY_REFRESH_DAYS = 0.5;
/** The warm-up refetches one nobody has replayed once it is this old. */
const WARM_REFRESH_DAYS = 7;

const dir = () => join(process.env.TAKIP_SPACE_HISTORY_DIR || join(process.cwd(), '.cache', 'space-history'), `v${VERSION}`);
const file = (id: number) => join(dir(), `${id}.json`);

const memory = new Map<number, CraftHistory>();
const inflight = new Map<number, Promise<CraftHistory | null>>();
const refreshedAt = new Map<number, number>();
let warming = false;

export function storedHistory(id: number): CraftHistory | null {
  const hit = memory.get(id);
  if (hit) return hit;
  try {
    const h = JSON.parse(readFileSync(file(id), 'utf8')) as CraftHistory;
    memory.set(id, h);
    return h;
  } catch {
    return null;
  }
}

function save(h: CraftHistory) {
  memory.set(h.id, h);
  try {
    mkdirSync(dir(), { recursive: true });
    // Renamed into place, so a crash mid-write never leaves half a file to be read.
    writeFileSync(`${file(h.id)}.tmp`, JSON.stringify(h));
    renameSync(`${file(h.id)}.tmp`, file(h.id));
  } catch { /* read-only disk (a serverless host): memory only */ }
}

/** One fetch per craft at a time; a failed one leaves what was stored. */
export function fetchHistory(id: number, name: string, lane: Lane): Promise<CraftHistory | null> {
  let p = inflight.get(id);
  if (!p) {
    p = collectHistory(id, name, lane)
      .then(h => {
        if (h) save(h);
        return h ?? storedHistory(id);
      })
      .catch(e => {
        console.warn(`[TAKIP] Horizons history ${id} ${name}:`, e instanceof Error ? e.message : e);
        return storedHistory(id);
      })
      .finally(() => inflight.delete(id));
    inflight.set(id, p);
  }
  return p;
}

/** The stored flight as it is, with a background refetch for next time once its prediction is old. */
export function keptHistory(id: number): CraftHistory | null {
  const h = storedHistory(id);
  const now = Date.now();
  // A refetch that failed is not retried on every open.
  if (h && historyDue(h, jdFromMs(now), REPLAY_REFRESH_DAYS) && now - (refreshedAt.get(id) ?? 0) > REPLAY_REFRESH_DAYS * 86_400_000) {
    refreshedAt.set(id, now);
    void fetchHistory(id, h.name, 'sweep');
  }
  return h;
}

/** Fetches every flight in `craft` not stored yet, then any a week old, one at a time behind map views. */
export async function warmHistories(craft: { id: number; name: string }[]): Promise<void> {
  if (warming) return;
  warming = true;
  try {
    const now = jdFromMs(Date.now());
    const due = craft
      .map(c => ({ ...c, kept: storedHistory(c.id) }))
      .filter(c => !c.kept || historyDue(c.kept, now, WARM_REFRESH_DAYS))
      .sort((a, b) => Number(!!a.kept) - Number(!!b.kept));
    for (const c of due) await fetchHistory(c.id, c.name, 'sweep');
  } finally {
    warming = false;
  }
}
