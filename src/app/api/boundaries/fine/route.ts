import { NextResponse } from 'next/server';
import { cellBox, FINE_LEVELS, type FineLevel } from '@/lib/areas/boundaries';
import { featuresInCell, loadFineSet } from '@/lib/areas/geoboundaries';

// Outlines change on geoBoundaries' release cycle, not daily; let the CDN keep them.
const CACHED = { 'Cache-Control': 'public, max-age=86400, s-maxage=2592000, stale-while-revalidate=604800' };

/**
 * GET /api/boundaries/fine?iso3=DEU&level=admin3&cell=2_12
 *
 * One country's districts (admin2) or sub-districts (admin3) that touch a CELL_DEG square, as a
 * FeatureCollection with the credit line its licence asks for in `source`. 404 when geoBoundaries
 * has no outlines at that level for the country.
 */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const iso3 = q.get('iso3') ?? '';
  const level = q.get('level') as FineLevel;
  const cell = q.get('cell') ?? '';
  if (!/^[A-Z]{3}$/.test(iso3) || !FINE_LEVELS.includes(level) || !cellBox(cell)) {
    return NextResponse.json({ error: 'iso3 must be ISO alpha-3, level admin2 or admin3, cell x_y' }, { status: 400 });
  }

  let set;
  try {
    set = await loadFineSet(iso3, level);
  } catch (err) {
    console.error(`[boundaries] ${iso3} ${level}:`, err);
    return NextResponse.json({ error: 'Outlines are unavailable right now' }, { status: 502, headers: { 'Cache-Control': 'no-store' } });
  }
  if (!set) return NextResponse.json({ error: `No ${level} outlines for ${iso3}` }, { status: 404, headers: CACHED });

  return NextResponse.json(
    { type: 'FeatureCollection', source: set.source, features: featuresInCell(set, cell) },
    { headers: CACHED },
  );
}
