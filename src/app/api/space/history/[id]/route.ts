import { NextResponse } from 'next/server';
import { cachedSource } from '@/lib/sourceCache';
import type { CraftHistory } from '@/lib/space/flight-history';
import { fleetSnapshot } from '../../fleet/collect';
import { collectHistory } from '../collect';

/** TAKIP — one spacecraft's whole flight, for replay (see ../collect). */

export const maxDuration = 120;

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id >= 0) return NextResponse.json({ error: 'Not a Horizons spacecraft ID' }, { status: 400 });
  const fleet = await fleetSnapshot(2_000);
  const craft = fleet.craft.find(c => c.id === id);
  if (!craft) return NextResponse.json({ error: 'Not in the tracked fleet' }, { status: 404 });
  // A finished flight barely changes; the predicted part is refreshed twice a day.
  const [history] = await cachedSource<CraftHistory>(`space:history:v7:${id}`, async () => {
    const h = await collectHistory(id, craft.name);
    return h ? [h] : [];
  }, 12 * 3_600_000)();
  if (!history) return NextResponse.json({ error: 'JPL Horizons could not place this craft' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  return NextResponse.json(history, { headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=43200' } });
}
