import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PlanetPageView, loadPlanet, planetMetadata } from '@/components/site/space/planet-page';

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return planetMetadata((await params).slug);
}

/** /planet/<key>: mercury to neptune, and pluto. */
export default async function PlanetRoute({ params }: Props) {
  const { slug } = await params;
  if (!(await loadPlanet(slug))) notFound();
  return <PlanetPageView planetKey={slug} />;
}
