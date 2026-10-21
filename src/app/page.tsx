import type { Metadata } from 'next';
import Dashboard from '@/components/shell/dashboard';
import { HomeIntro } from '@/components/site/pages/home-intro';
import { getT } from '@/lib/core/i18n/request';
import { describeView } from '@/lib/platform/site/share-view';
import { SITE_TITLE } from '@/lib/platform/site/site-copy';

// One URL in every language: the map follows the reader's own, so / is the x-default.
const ALTERNATES = { canonical: '/', languages: { 'x-default': '/' } };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/** A shared link previews as what it shows; the plain address keeps the site's own title and card. */
export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const t = await getT();
  const view = describeView(await searchParams, t);
  if (!view.title) return { title: { absolute: t(SITE_TITLE) }, alternates: ALTERNATES };
  const image = { url: `/og?${view.imageQuery}`, width: 1200, height: 630, alt: view.title };
  return {
    // The layout's title template reaches only child segments, not the page beside it.
    title: { absolute: `${view.title} · TAKIP` },
    description: view.description,
    alternates: ALTERNATES,
    openGraph: { title: view.title, description: view.description, type: 'website', siteName: 'TAKIP', images: [image] },
    twitter: { card: 'summary_large_image', title: view.title, description: view.description, images: [image.url] },
  };
}

export default function Home() {
  return (
    <>
      <Dashboard />
      <HomeIntro />
    </>
  );
}
