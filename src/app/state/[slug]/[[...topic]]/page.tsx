import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PlacePage, placeMetadata } from '@/components/site/places/place-page';

type Props = { params: Promise<{ slug: string; topic?: string[] }> };

/** /state/<slug> and /state/<slug>/<page>; anything deeper is not a page. */
const parts = async (params: Props['params']) => {
  const { slug, topic = [] } = await params;
  return topic.length > 1 ? null : { slug, page: topic[0] };
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = await parts(params);
  return p ? placeMetadata('state', p.slug, p.page) : {};
}

export default async function StateRoute({ params }: Props) {
  const p = await parts(params);
  const page = p && await PlacePage({ kind: 'state', ...p });
  if (!page) notFound();
  return page;
}
