import { NextResponse } from 'next/server';
import { fetchNasStatus, placeDelays, type AirportDelay, type NasDelay } from './nas-status';

/**
 * TAKIP — US airport delay programmes, ground stops and closures (FAA NAS Status).
 * Not `cachedSource`: it treats `[]` as a failure, and no delays is the normal answer.
 */

export const dynamic = 'force-dynamic';

const TTL_MS = 2 * 60_000;
const STALE_LIMIT_MS = 15 * 60_000;

interface Payload {
  airports: AirportDelay[];
  unplaced: NasDelay[];
  updated: string | null;
  timestamp: string;
}

async function collect(): Promise<Payload> {
  const status = await fetchNasStatus();
  if (status.unknownBlocks.length) console.warn(`[TAKIP] FAA NAS: unknown delay blocks ${status.unknownBlocks.join(', ')}`);
  const { airports, unplaced } = placeDelays(status.delays);
  return { airports, unplaced, updated: status.updated, timestamp: new Date().toISOString() };
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
      headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[TAKIP] FAA NAS status fetch failed:', message);
    if (memo && Date.now() - memo.at < STALE_LIMIT_MS) {
      return NextResponse.json({ ...memo.data, stale: true }, { headers: { 'Cache-Control': 'no-store' } });
    }
    return NextResponse.json({ airports: [], unplaced: [], error: 'FAA NAS status unavailable' }, { status: 502 });
  }
}
