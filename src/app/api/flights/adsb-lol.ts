import { record } from '@takip/archive/recorder';
import { TAKIP_USER_AGENT as UA } from '@/lib/user-agent';

/**
 * TAKIP — adsb.lol, keyless, ODbL (verify). The same tar1090 rows as adsb.fi (non-commercial), so classifyFlight()
 * reads them unchanged. /v2/all is 404, but /v2/mil and /v2/type/{T1,T2,…} cover the whole receiver network.
 * A type batch can take ~7 s and the token bucket refills about once a second, so batches are paced 2 s apart,
 * back off on 429 (giving up after 20 s of waiting), and run in the background: a request never waits on them.
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

const SNAPSHOT_EVERY_MS = 240_000;
/** Older than this, a snapshot is dropped rather than served. */
const SNAPSHOT_MAX_AGE_MS = 15 * 60_000;
const BATCH_GAP_MS = 2000;
/** A 429 is retried after 2, 4 and 8 s; past this much waiting the cycle gives up. */
const BACKOFF_LIMIT_MS = 20_000;

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

async function getAc(url: string, timeoutMs: number): Promise<{ status: number; ac: unknown[] | null }> {
  const started = Date.now();
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' }, signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) {
      record('adsblol', { url, status: res.status, ms: Date.now() - started }, null);
      await res.body?.cancel();
      return { status: res.status, ac: null };
    }
    const text = await res.text();
    record('adsblol', { url, status: res.status, ms: Date.now() - started }, text);
    const ac = (JSON.parse(text) as { ac?: unknown }).ac;
    return { status: res.status, ac: Array.isArray(ac) ? ac : null };
  } catch (e) {
    record('adsblol', { url, status: 0, err: String(e) }, null);
    return { status: 0, ac: null };
  }
}

/** Military aircraft worldwide, or null when adsb.lol did not answer with a list. */
export async function fetchAdsbLolMil(): Promise<unknown[] | null> {
  return (await getAc(ADSBLOL_MIL, 15_000)).ac;
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
    let { status, ac } = await getAc(typeBatchUrl(batch.types), 20_000);
    for (let backoff = 2000; status === 429 && waited + backoff <= BACKOFF_LIMIT_MS; backoff *= 2) {
      await sleep(backoff);
      waited += backoff;
      ({ status, ac } = await getAc(typeBatchUrl(batch.types), 20_000));
    }
    if (ac) {
      snap.ac.push(...ac);
      snap.answered.push(batch.name);
    } else {
      (status === 429 ? snap.refused : snap.failed).push(batch.name);
    }
  }
  snap.at = Date.now();
  return snap;
}

let current: TypeSnapshot | null = null;
let refreshing: Promise<void> | null = null;
let lastAttempt: Omit<TypeSnapshot, 'ac'> & { n: number } | null = null;

/** The most recent refresh, kept even when it was not good enough to replace the snapshot. */
export const adsbLolLastAttempt = () => lastAttempt;

/**
 * The latest typed snapshot, or null when there is none fresh enough. A stale one starts a background
 * refresh; a snapshot whose batches all failed never replaces a good one.
 */
export function adsbLolTypeSnapshot(now = Date.now()): TypeSnapshot | null {
  if (!refreshing && (!current || now - current.at >= SNAPSHOT_EVERY_MS)) {
    refreshing = collectTypeSnapshot()
      .then(snap => {
        const { ac, ...summary } = snap;
        lastAttempt = { ...summary, n: ac.length };
        if (snap.answered.length) current = snap;
      })
      .catch(e => console.warn('[TAKIP] adsb.lol type snapshot failed:', e))
      .finally(() => { refreshing = null; });
  }
  return current && now - current.at < SNAPSHOT_MAX_AGE_MS ? current : null;
}

/** As adsbLolTypeSnapshot, but waits for the first refresh when there is nothing to serve yet. */
export async function awaitAdsbLolTypeSnapshot(): Promise<TypeSnapshot | null> {
  const ready = adsbLolTypeSnapshot();
  if (ready || !refreshing) return ready;
  await refreshing;
  return adsbLolTypeSnapshot();
}

/** Test seam. */
export function resetAdsbLolSnapshot(): void {
  current = null;
  refreshing = null;
  lastAttempt = null;
}
