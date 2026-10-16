import { NextResponse } from 'next/server';
import { REFERENCE_DATASETS } from '@/lib/feeds/reference/catalog';
import { createFileStore } from '@/lib/feeds/reference/file-store';

/**
 * GET /api/reference: the static reference datasets and whether this server
 * has each one installed (data/reference/, see its README). Deployments
 * without the files report `available: false`, and the UI hides the layers.
 */
export async function GET() {
  const store = createFileStore();
  const datasets = await Promise.all(REFERENCE_DATASETS.map(async d => {
    const s = await store.stat(d.id);
    return {
      id: d.id,
      key: d.key,
      label: d.label,
      group: d.group,
      geometry: d.geometry,
      minZoom: d.minZoom,
      attribution: d.attribution,
      available: s !== null,
      bytes: s?.bytes ?? null,
      updated: s?.updated ?? null,
    };
  }));
  return NextResponse.json(
    { available: datasets.some(d => d.available), datasets },
    { headers: { 'Cache-Control': 'public, max-age=60' } },
  );
}
