import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { loadSky, SkyPageView, skyMetadata } from '@/components/site/space/sky-page';

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return skyMetadata((await params).slug);
}

/** /deep-sky/<id>: each telescope picture the space view hangs, slugged by its id. */
export default async function DeepSkyObjectRoute({ params }: Props) {
  const { slug } = await params;
  if (!(await loadSky(slug))) notFound();
  return <SkyPageView slug={slug} />;
}
