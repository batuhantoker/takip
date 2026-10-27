import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { loadOuter, OuterPageView, outerMetadata } from '@/components/site/space/outer-page';
import { PlanetPageView, loadPlanet, planetMetadata } from '@/components/site/space/planet-page';

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  return (await loadPlanet(slug)) ? planetMetadata(slug) : outerMetadata(slug);
}

/** /planet/<key>: mercury to neptune and pluto, the dwarf planets past them, and the interstellar visitors. */
export default async function PlanetRoute({ params }: Props) {
  const { slug } = await params;
  if (await loadPlanet(slug)) return <PlanetPageView planetKey={slug} />;
  if (await loadOuter(slug)) return <OuterPageView outerKey={slug} />;
  notFound();
}
