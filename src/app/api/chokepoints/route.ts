import { NextResponse } from 'next/server';
import { createPool } from '@/lib/fetch-pool';
import {
  buildChokepoints,
  dailyQuery,
  disruptionsQuery,
  fetchAllRows,
  groupDaily,
  parseDisruptions,
  toChokepointRef,
  CHOKEPOINTS_LAYER,
  CHOKEPOINTS_QUERY,
  DAILY_LAYER,
  DISRUPTIONS_LAYER,
  type Chokepoint,
  type ChokepointRef,
  type Disruption,
} from './portwatch';

/**
 * TAKIP — strategic chokepoint transits (IMF PortWatch) rated against each
 * chokepoint's own recent baseline, plus open and recently ended disruptions.
 */

export const dynamic = 'force-dynamic';

const TTL_MS = 6 * 60 * 60_000;
// Upstream is weekly, so a day-old answer beats an error.
const STALE_LIMIT_MS = 24 * 60 * 60_000;

const pool = createPool(4);

interface Payload {
  chokepoints: Chokepoint[];
  disruptions: Disruption[];
  timestamp: string;
}

async function collect(): Promise<Payload> {
  const now = Date.now();
  const [refRows, dailyRows, disruptionRows] = await Promise.all([
    pool.run(() => fetchAllRows(CHOKEPOINTS_LAYER, CHOKEPOINTS_QUERY)),
    pool.run(() => fetchAllRows(DAILY_LAYER, dailyQuery(now))),
    pool.run(() => fetchAllRows(DISRUPTIONS_LAYER, disruptionsQuery(now))),
  ]);
  const refs = refRows.map(toChokepointRef).filter((r): r is ChokepointRef => r !== null);
  if (!refs.length) throw new Error('PortWatch: no chokepoints in the reference layer');
  if (!dailyRows.length) throw new Error('PortWatch: no daily transits');
  const disruptions = parseDisruptions(disruptionRows, now);
  return {
    chokepoints: buildChokepoints(refs, groupDaily(dailyRows), disruptions),
    disruptions,
    timestamp: new Date(now).toISOString(),
  };
}

let memo: { at: number; data: Payload } | null = null;
let inflight: Promise<Payload> | null = null;

function load(): Promise<Payload> {
  if (memo && Date.now() - memo.at < TTL_MS) return Promise.resolve(memo.data);
  inflight ??= collect()
    .then(data => {
      memo = { at: Date.now(), data };
      return data;
    })
    .finally(() => { inflight = null; });
  return inflight;
}

export async function GET() {
  try {
    return NextResponse.json(await load(), {
      headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=21600' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[TAKIP] PortWatch fetch failed:', message);
    if (memo && Date.now() - memo.at < STALE_LIMIT_MS) {
      return NextResponse.json({ ...memo.data, stale: true }, { headers: { 'Cache-Control': 'no-store' } });
    }
    return NextResponse.json({ chokepoints: [], disruptions: [], error: 'PortWatch unavailable' }, { status: 502 });
  }
}
