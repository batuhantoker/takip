import type { Metadata } from 'next';
import { EmbedView, embedMetadata } from '@/components/site/embed/embed-view';
import { getT } from '@/lib/core/i18n/request';
import { bboxView, historyLink, parseEmbedSpec } from '@/lib/map/embed/spec';
import { mapHref } from '@/lib/platform/site/map-link';

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata(): Promise<Metadata> {
  return embedMetadata((await getT())('Live map'));
}

/** Any spec as a query (lib/map/embed/spec.ts): a place and a period, a layer at a view, a link by hand. */
export default async function SpecEmbed({ searchParams }: Props) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    const first = Array.isArray(value) ? value[0] : value;
    if (first !== undefined) query.set(key, first);
  }
  const spec = parseEmbedSpec(query);
  const view = spec.view ?? (spec.bbox ? bboxView(spec.bbox) : undefined);
  // A window opens History over the same years; History keeps the visitor's own layers.
  const mode = historyLink(spec);
  return <EmbedView spec={spec} fullMap={mapHref({ layers: mode ? [] : spec.layers, view, track: spec.track, mode })} />;
}
