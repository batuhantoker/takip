import { record } from '@takip/archive/recorder';
import { TAKIP_USER_AGENT as UA } from '@/lib/user-agent';

/**
 * TAKIP — adsb.lol, keyless, ODbL (verify). The same tar1090 rows as adsb.fi (non-commercial), so classifyFlight()
 * reads them unchanged. /v2/all is 404, but /v2/mil and /v2/type/{T1,T2,…} cover the whole receiver network.
 * Its rate limit is dynamic and tight: batches are 5 s apart, every 10 minutes, honour Retry-After, give up
 * after 20 s of backing off, and run in the background, so a request never waits on them.
 */

export const ADSBLOL_BASE = 'https://api.adsb.lol/v2';
export const ADSBLOL_MIL = `${ADSBLOL_BASE}/mil`;

/** Most valuable first: when the budget runs out, general aviation is the batch to lose. */
export const TYPE_BATCHES: { name: string; types: string[] }[] = [
  { name: 'mainline', types: [
    'A319', 'A320', 'A321', 'A20N', 'A21N', 'A332', 'A333', 'A339', 'A359', 'A35K', 'A388',
    'B737', 'B738', 'B739', 'B38M', 'B39M', 'B752', 'B763', 'B764', 'B772', 'B77L', 'B77W', 'B744', 'B748',
    'B788', 'B789', 'B78X',
  ] },
  { name: 'regional', types: [
    'E170', 'E175', 'E190', 'E195', 'E290', 'E295', 'CRJ2', 'CRJ7', 'CRJ9', 'CRJX', 'BCS1', 'BCS3',
    'AT43', 'AT45', 'AT72', 'AT76', 'DH8A', 'DH8C', 'DH8D', 'SU95', 'A306', 'MD11', 'B712',
  ] },
  { name: 'bizjet', types: [
    'GLEX', 'GL5T', 'GL7T', 'GLF4', 'GLF5', 'GLF6', 'G280', 'CL30', 'CL35', 'CL60', 'C25A', 'C25B', 'C25C',
    'C525', 'C560', 'C56X', 'C68A', 'C700', 'C750', 'E35L', 'E50P', 'E55P', 'FA7X', 'FA8X', 'F2TH', 'F900',
    'LJ45', 'LJ60', 'PC24',
  ] },
  { name: 'ga', types: [
    'C172', 'C182', 'C208', 'P28A', 'SR22', 'DA40', 'DA42', 'BE20', 'BE36', 'BE9L', 'PC12', 'TBM9',
    'R44', 'R66', 'EC35', 'EC45', 'H135', 'H145', 'AS50', 'B407', 'A139', 'S76',
  ] },
];

export const typeBatchUrl = (types: string[]) => `${ADSBLOL_BASE}/type/${types.join(',')}`;

// Measured 2026-10-12: three requests in quick succession pass, the fourth gets 429 unless ~5 s apart.
const SNAPSHOT_EVERY_MS = 10 * 60_000;
/** Older than this, a snapshot is dropped rather than served. */
const SNAPSHOT_MAX_AGE_MS = 25 * 60_000;
const BATCH_GAP_MS = 5000;
/** A 429 is retried after its Retry-After, else 4 then 8 s; past this much waiting the cycle gives up. */
const BACKOFF_LIMIT_MS = 20_000;
/** After a cycle gives up, every adsb.lol call (/v2/mil included) waits at least this long. */
const COOLDOWN_MS = 60_000;

export interface TypeSnapshot {
  ac: unknown[];
  at: number;
  answered: string[];
  /** Timed out or errored; the next batch is still asked. */
  failed: string[];
  /** Answered 429: the rest of the cycle is skipped. */
  refused: string[];
  skipped: string[];
}

interface State {
  current: TypeSnapshot | null;
  refreshing: Promise<void> | null;
  lastAttempt: (Omit<TypeSnapshot, 'ac'> & { n: number }) | null;
  cooldownUntil: number;
}

// On globalThis: dev reloads and duplicated bundles would otherwise each start their own refresh cycle.
const holder = globalThis as unknown as { takipAdsbLol?: State };
const state = (): State => (holder.takipAdsbLol ??= { current: null, refreshing: null, lastAttempt: null, cooldownUntil: 0 });

/** Retry-After as milliseconds, when it is a number of seconds. */
export function retryAfterMs(header: string | null): number | null {
  const s = header == null ? NaN : Number(header.trim());
  return Number.isFinite(s) && s >= 0 ? s * 1000 : null;
}

async function getAc(url: string, timeoutMs: number): Promise<{ status: number; ac: unknown[] | null; retryAfter: number | null }> {
  const started = Date.now();
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' }, signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) {
      record('adsblol', { url, status: res.status, ms: Date.now() - started }, null);
      await res.body?.cancel();
      return { status: res.status, ac: null, retryAfter: retryAfterMs(res.headers.get('retry-after')) };
    }
    const text = await res.text();
    record('adsblol', { url, status: res.status, ms: Date.now() - started }, text);
    const ac = (JSON.parse(text) as { ac?: unknown }).ac;
    return { status: res.status, ac: Array.isArray(ac) ? ac : null, retryAfter: null };
  } catch (e) {
    record('adsblol', { url, status: 0, err: String(e) }, null);
    return { status: 0, ac: null, retryAfter: null };
  }
}

/** Military aircraft worldwide, or null when adsb.lol did not answer with a list or is cooling down. */
export async function fetchAdsbLolMil(now = Date.now()): Promise<unknown[] | null> {
  if (now < state().cooldownUntil) return null;
  const { status, ac, retryAfter } = await getAc(ADSBLOL_MIL, 15_000);
  if (status === 429) state().cooldownUntil = Date.now() + Math.max(retryAfter ?? 0, COOLDOWN_MS);
  return ac;
}

export async function collectTypeSnapshot(
  sleep: (ms: number) => Promise<void> = ms => new Promise(resolve => setTimeout(resolve, ms)),
): Promise<TypeSnapshot> {
  const snap: TypeSnapshot = { ac: [], at: Date.now(), answered: [], failed: [], refused: [], skipped: [] };
  let waited = 0;
  for (const batch of TYPE_BATCHES) {
    if (snap.refused.length) {
      snap.skipped.push(batch.name);
      continue;
    }
    // Also spaces the first batch from the /v2/mil read that usually precedes it.
    await sleep(BATCH_GAP_MS);
    let res = await getAc(typeBatchUrl(batch.types), 20_000);
    for (let step = 4000; res.status === 429; step *= 2) {
      const wait = res.retryAfter ?? step;
      if (waited + wait > BACKOFF_LIMIT_MS) break;
      await sleep(wait);
      waited += wait;
      res = await getAc(typeBatchUrl(batch.types), 20_000);
    }
    if (res.ac) {
      snap.ac.push(...res.ac);
      snap.answered.push(batch.name);
    } else if (res.status === 429) {
      snap.refused.push(batch.name);
      state().cooldownUntil = Date.now() + Math.max(res.retryAfter ?? 0, COOLDOWN_MS);
    } else {
      snap.failed.push(batch.name);
    }
  }
  snap.at = Date.now();
  return snap;
}

/** The most recent refresh, kept even when it was not good enough to replace the snapshot. */
export const adsbLolLastAttempt = () => state().lastAttempt;

/**
 * The latest typed snapshot, or null when there is none fresh enough. A stale one starts a background
 * refresh, unless adsb.lol is cooling down; a snapshot whose batches all failed never replaces a good one.
 */
export function adsbLolTypeSnapshot(now = Date.now()): TypeSnapshot | null {
  const st = state();
  if (!st.refreshing && now >= st.cooldownUntil && (!st.current || now - st.current.at >= SNAPSHOT_EVERY_MS)) {
    st.refreshing = collectTypeSnapshot()
      .then(snap => {
        const { ac, ...summary } = snap;
        st.lastAttempt = { ...summary, n: ac.length };
        if (snap.answered.length) st.current = snap;
      })
      .catch(e => console.warn('[TAKIP] adsb.lol type snapshot failed:', e))
      .finally(() => { st.refreshing = null; });
  }
  return st.current && now - st.current.at < SNAPSHOT_MAX_AGE_MS ? st.current : null;
}

/** As adsbLolTypeSnapshot, but waits for the first refresh when there is nothing to serve yet. */
export async function awaitAdsbLolTypeSnapshot(): Promise<TypeSnapshot | null> {
  const ready = adsbLolTypeSnapshot();
  const pending = state().refreshing;
  if (ready || !pending) return ready;
  await pending;
  return adsbLolTypeSnapshot();
}

type Row = { hex?: unknown; t?: unknown; r?: unknown; dbFlags?: unknown };

/**
 * A position row (OpenSky's, fresher) with the aircraft type, registration and military flag that only
 * adsb.lol carries. Position, speed and accuracy stay the fresher row's own.
 */
export function withAircraftType<T extends Row>(row: T, typed: Row | undefined): T {
  if (!typed) return row;
  return { ...row, t: row.t ?? typed.t, r: row.r ?? typed.r, dbFlags: row.dbFlags ?? typed.dbFlags };
}

/** Test seam. */
export function resetAdsbLolSnapshot(): void {
  holder.takipAdsbLol = { current: null, refreshing: null, lastAttempt: null, cooldownUntil: 0 };
}
