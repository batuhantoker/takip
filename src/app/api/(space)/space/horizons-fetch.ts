import { coverageGap, gridParams, horizonsUrl, jdFromMs, longitudeSense, parseObserver, parseVectors, vectorParams, type CoverageGap, type Grid, type StateRow } from '@/lib/space/horizons';

/**
 * TAKIP — calls to JPL Horizons. No key, but it answers 502/503 to more than a
 * couple of requests at once from one client, so all calls share two slots.
 * Map views take the next free slot ahead of the background fleet sweep.
 */

const UA = 'TAKIP/0.1 (+https://github.com/batuhantoker/takip)';
const SLOTS = 2;
export type Lane = 'interactive' | 'sweep';

let active = 0;
const queues: Record<Lane, (() => void)[]> = { interactive: [], sweep: [] };

function drain() {
  while (active < SLOTS) {
    const start = queues.interactive.shift() ?? queues.sweep.shift();
    if (!start) return;
    active++;
    start();
  }
}

function schedule<T>(lane: Lane, task: () => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    queues[lane].push(() => task().then(resolve, reject).finally(() => { active--; drain(); }));
    drain();
  });
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

export type Reply<T> =
  | { ok: true; rows: T[] }
  | { ok: false; gap: CoverageGap | null; error: string };

async function call(params: Record<string, string>, lane: Lane): Promise<{ result: string } | { error: string }> {
  return schedule(lane, async () => {
    for (let attempt = 0; ; attempt++) {
      const res = await fetch(horizonsUrl(params), { headers: { 'User-Agent': UA, Accept: 'application/json' }, signal: AbortSignal.timeout(25_000) });
      // The backoff holds the slot, which is the point: it slows every caller down.
      if ((res.status === 502 || res.status === 503 || res.status === 429) && attempt < 3) {
        await sleep(1500 * 2 ** attempt);
        continue;
      }
      const json = await res.json().catch(() => null) as { result?: string; error?: string } | null;
      if (!json) throw new Error(`Horizons HTTP ${res.status}`);
      if (lane === 'sweep') await sleep(150);
      if (json.error) return { error: String(json.error) };
      return { result: String(json.result ?? '') };
    }
  });
}

function failure<T>(text: string): Reply<T> {
  return { ok: false, gap: coverageGap(text), error: text.trim().split('\n').slice(-3).join(' ').slice(0, 300) };
}

export async function vectors(command: string, grid: Grid, lane: Lane, center?: string): Promise<Reply<StateRow>> {
  const reply = await call(vectorParams(command, grid, center), lane);
  if ('error' in reply) return failure(reply.error);
  const rows = parseVectors(reply.result);
  return rows.length ? { ok: true, rows } : failure(reply.result);
}

const MINUTE_JD = 1 / 1440;

/**
 * Vectors over whatever part of `grid` the craft's ephemeris covers. Horizons
 * rejects the whole request if any epoch falls outside it and names the
 * boundary, so one retry, trimmed to the grid points inside it, recovers a
 * craft launched mid-window.
 */
export async function coveredVectors(command: string, grid: Grid, lane: Lane): Promise<Reply<StateRow>> {
  const first = await vectors(command, grid, lane);
  if (first.ok || !first.gap) return first;
  const edge = jdFromMs(first.gap.boundary.getTime());
  const step = grid.stepMinutes * MINUTE_JD;
  let { start, stop } = grid;
  if (first.gap.kind === 'before') start += Math.ceil((edge + MINUTE_JD - start) / step) * step;
  else stop -= Math.ceil((stop - edge + MINUTE_JD) / step) * step;
  if (start > stop || (start === grid.start && stop === grid.stop)) return first;
  return vectors(command, { ...grid, start, stop }, lane);
}

export type ObserverReply = Reply<Record<string, string>> & { sense?: 'east' | 'west' | null };

export async function observer(params: Record<string, string>, grid: Grid, lane: Lane): Promise<ObserverReply> {
  const reply = await call({ OBJ_DATA: 'NO', MAKE_EPHEM: 'YES', EPHEM_TYPE: 'OBSERVER', CSV_FORMAT: 'YES', ...params, ...gridParams(grid) }, lane);
  if ('error' in reply) return failure(reply.error);
  const rows = parseObserver(reply.result);
  return rows.length ? { ok: true, rows, sense: longitudeSense(reply.result) } : failure(reply.result);
}

/** The raw `COMMAND='MB'` listing. */
export async function majorBodies(): Promise<string> {
  const reply = await call({ COMMAND: 'MB' }, 'sweep');
  if ('error' in reply) throw new Error(reply.error);
  return reply.result;
}
