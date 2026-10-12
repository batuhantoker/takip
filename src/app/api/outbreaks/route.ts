import { NextResponse } from 'next/server';
import { memoSource, type Memoized } from '@/app/api/advisories/source-memo';
import { aggregateOutbreaks } from './aggregate';
import { fetchCdcNotices } from './cdc-notices';
import { ECDC_TERMS, fetchEcdcFeed } from './ecdc';
import type { OutbreakNotice, OutbreakSourceStatus } from './types';
import { fetchWhoDon } from './who-don';

/**
 * TAKIP — disease outbreaks as country-level points from WHO DON, CDC travel notices and ECDC.
 * WHO content is non-commercial (CC BY-NC-SA 3.0 IGO). CDC is public domain; ECDC needs attribution.
 * A failed source is listed in `sources`, never folded into an empty map.
 */

const HOUR = 60 * 60_000;

const WHO = { name: 'WHO Disease Outbreak News', load: memoSource(fetchWhoDon, HOUR) };
const CDC = { name: 'CDC Travel Health Notices', load: memoSource(fetchCdcNotices, HOUR) };
const ECDC = ECDC_TERMS.map(t => ({ name: t.name, load: memoSource(() => fetchEcdcFeed(t.id), HOUR) }));

type Loaded = { name: string; memo: Memoized<OutbreakNotice[]> };

function status({ name, memo }: Loaded): OutbreakSourceStatus {
  if (!memo.loaded) return { name, ok: false, error: memo.error ?? 'not loaded' };
  return memo.error ? { name, ok: true, stale: true, error: memo.error } : { name, ok: true };
}

/** One request at a time to the ECDC host. */
async function loadEcdc(): Promise<Loaded[]> {
  const out: Loaded[] = [];
  for (const feed of ECDC) out.push({ name: feed.name, memo: await feed.load() });
  return out;
}

export async function GET() {
  const [who, cdc, ecdc] = await Promise.all([
    WHO.load().then(memo => ({ name: WHO.name, memo })),
    CDC.load().then(memo => ({ name: CDC.name, memo })),
    loadEcdc(),
  ]);
  const loaded: Loaded[] = [who, cdc, ...ecdc];
  const { outbreaks, worldwide, unmatched } = aggregateOutbreaks(loaded.flatMap(l => l.memo.value ?? []), Date.now());

  return NextResponse.json({
    outbreaks,
    worldwide,
    unmatched,
    sources: loaded.map(status),
    timestamp: new Date().toISOString(),
  }, {
    headers: { 'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=3600' },
  });
}
