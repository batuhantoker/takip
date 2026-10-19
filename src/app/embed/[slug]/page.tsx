import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { EmbedView, embedMetadata } from '@/components/site/embed/embed-view';
import { hasEmbed, pageEmbed } from '@/lib/platform/site/embed';
import { availablePages, layerPage, openPath } from '@/lib/platform/site/layer-pages';

type Props = { params: Promise<{ slug: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return availablePages().filter(hasEmbed).map(p => ({ slug: p.slug }));
}

const embeddable = (slug: string) => {
  const page = layerPage(slug);
  return page && hasEmbed(page) ? page : null;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const page = embeddable((await params).slug);
  return page ? embedMetadata(page.title) : {};
}

/** A layer page's live map, for the iframe in its hero. */
export default async function LayerEmbed({ params }: Props) {
  const page = embeddable((await params).slug);
  if (!page) notFound();
  return <EmbedView spec={pageEmbed(page)} fullMap={openPath(page)} />;
}
