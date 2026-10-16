import { NextResponse } from 'next/server';
import type { CraftHistory } from '@/lib/space/replay/flight-history';
import { catalogueCraft } from '../../fleet/collect';
import { fetchHistory, keptHistory } from '../store';

/** TAKIP — one spacecraft's whole flight, for replay (see ../collect and ../store). */

export const maxDuration = 120;

const send = (h: CraftHistory) => NextResponse.json(h, { headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=43200' } });
const fail = (error: string, status: number) => NextResponse.json({ error }, { status, headers: { 'Cache-Control': 'no-store' } });

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id >= 0) return fail('Not a Horizons spacecraft ID', 400);
  const kept = keptHistory(id);
  if (kept) return send(kept);
  const craft = await catalogueCraft(id).catch(() => undefined);
  if (craft === undefined) return fail('JPL Horizons could not be reached', 503);
  if (!craft) return fail('Not in the Horizons spacecraft catalogue', 404);
  const history = await fetchHistory(id, craft.name, 'interactive');
  return history ? send(history) : fail('JPL Horizons could not place this craft', 503);
}
