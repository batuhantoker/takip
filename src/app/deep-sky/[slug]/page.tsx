import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { loadSky, SkyPageView, skyMetadata } from '@/components/site/space/sky-page';
import { loadStructure, StructurePageView, structureMetadata } from '@/components/site/space/structure-page';

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  return (await loadSky(slug)) ? skyMetadata(slug) : structureMetadata(slug);
}

/** /deep-sky/<id>: each telescope picture the space view hangs, and each structure it draws past them, by its id. */
export default async function DeepSkyObjectRoute({ params }: Props) {
  const { slug } = await params;
  if (await loadSky(slug)) return <SkyPageView slug={slug} />;
  if (await loadStructure(slug)) return <StructurePageView slug={slug} />;
  notFound();
}
