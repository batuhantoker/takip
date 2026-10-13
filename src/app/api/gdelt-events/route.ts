import { NextResponse } from 'next/server';
import { fetchGdeltEvents } from '@/lib/alerts/gdelt-events';
import { GDELT_FAMILIES, type GdeltFamily } from '@takip/connectors/gdelt/cameo';

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
 * violence, protest, tension, cooperation or all.
 */

const MAX_LIMIT = 2000;

// Statements and consultations are most of the feed; a threat map leaves them out unless asked.
const DEFAULT_FAMILIES: GdeltFamily[] = ['violence', 'protest', 'tension'];

function parseFamilies(raw: string | null): GdeltFamily[] {
  if (raw === 'all') return [...GDELT_FAMILIES];
  const picked = (raw ?? '').split(',').map(v => v.trim()).filter((v): v is GdeltFamily => GDELT_FAMILIES.includes(v as GdeltFamily));
  return picked.length ? picked : DEFAULT_FAMILIES;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const families = parseFamilies(searchParams.get('family'));
  const minReports = Math.max(1, Number(searchParams.get('min_reports')) || 2);
  const hours = Math.min(6, Math.max(1, Number(searchParams.get('hours')) || 2));
  const limit = Math.min(MAX_LIMIT, Math.max(1, Number(searchParams.get('limit')) || 600));

  try {
    const { events, windows, stats } = await fetchGdeltEvents({ families, minReports, limit, hours });

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
