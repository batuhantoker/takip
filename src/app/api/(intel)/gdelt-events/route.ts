import { NextResponse } from 'next/server';
import { fetchGdeltEvents, type FetchOptions, type GdeltEventsResult } from '@/lib/intel/alerts/gdelt-events';
import { GDELT_FAMILIES, type GdeltFamily } from '@takip/connectors/gdelt/cameo';
import { peekLinkPreview, warmLinkPreviews } from '@/lib/core/link-preview/fetch';
import { pickHeadline } from '@/lib/intel/alerts/gdelt-alerts';

export const maxDuration = 60;

/**
 * TAKIP — GDELT 2.0 Geocoded Events
 * Source: GDELT Project 15-minute Events export — free, no auth required.
 * https://www.gdeltproject.org/
 *
 * Distinct from /api/gdelt, which despite its name reads GDACS disaster alerts.
 * This route serves the stories of the last `hours` (1–6, default 2), each
 * reported by at least `min_reports` distinct headlines (default 2; 1 keeps
 * single reports), see @takip/connectors/gdelt/reduce. `family` takes
 * violence, protest, tension, cooperation or all. A story carries `headline`,
 * its lead article's own title, once the page has been read in the background.
 */

const MAX_LIMIT = 2000;

// Statements and consultations are most of the feed; a threat map leaves them out unless asked.
const DEFAULT_FAMILIES: GdeltFamily[] = ['violence', 'protest', 'tension'];

function parseFamilies(raw: string | null): GdeltFamily[] {
  if (raw === 'all') return [...GDELT_FAMILIES];
  const picked = (raw ?? '').split(',').map(v => v.trim()).filter((v): v is GdeltFamily => GDELT_FAMILIES.includes(v as GdeltFamily));
  return picked.length ? picked : DEFAULT_FAMILIES;
}

/* Every open Alerts panel asks for the same answer; reduce the windows once per
   couple of minutes for all of them, and once at a time when cold. */
const SHARE_MS = 2 * 60_000;
const shared = new Map<string, { at: number; result: Promise<GdeltEventsResult> }>();

function sharedEvents(opts: FetchOptions): Promise<GdeltEventsResult> {
  const key = JSON.stringify(opts);
  const hit = shared.get(key);
  if (hit && Date.now() - hit.at < SHARE_MS) return hit.result;
  const result = fetchGdeltEvents(opts);
  shared.set(key, { at: Date.now(), result });
  result.catch(() => { if (shared.get(key)?.result === result) shared.delete(key); });
  for (const [k, v] of shared) if (Date.now() - v.at > SHARE_MS) shared.delete(k);
  return result;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const families = parseFamilies(searchParams.get('family'));
  const minReports = Math.max(1, Number(searchParams.get('min_reports')) || 2);
  const hours = Math.min(6, Math.max(1, Number(searchParams.get('hours')) || 2));
  const limit = Math.min(MAX_LIMIT, Math.max(1, Number(searchParams.get('limit')) || 600));

  try {
    const { events: found, windows, stats } = await sharedEvents({ families, minReports, limit, hours });
    // Lead articles' own headlines, as far as they have been read; the rest are read for the next answer.
    warmLinkPreviews(found.map(e => e.url));
    const events = found.map(e => {
      const headline = pickHeadline(e.links[0]?.title ?? null, peekLinkPreview(e.url)?.title ?? null);
      return headline ? { ...e, headline } : e;
    });

    return NextResponse.json(
      {
        events,
        total: events.length,
        stats,
        windows,
        source: 'GDELT 2.0 Events',
        timestamp: new Date().toISOString(),
      },
      {
        // GDELT publishes a new export every 15 minutes, so anything under that
        // is wasted work. Serve stale while revalidating to absorb bursts.
        headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
      }
    );
  } catch (error) {
    console.error('[TAKIP] GDELT events fetch failed:', error);
    return NextResponse.json(
      { events: [], total: 0, error: 'Failed to fetch GDELT events' },
      { status: 502 }
    );
  }
}
