import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { GuidePage, guideMetadata } from '@/components/site/guides/guide-pages';

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return guideMetadata((await params).slug);
}

export default async function GuideRoute({ params }: Props) {
  const page = await GuidePage({ slug: (await params).slug });
  if (!page) notFound();
  return page;
}
