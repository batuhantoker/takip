import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import { MountainPageView, loadMountain, mountainMetadata } from '@/components/site/mountains/mountain-page';
import { requestLocale } from '@/lib/core/i18n/request';
import { isSlug } from '@/lib/platform/site/events/slug';
import { localePath } from '@/lib/platform/site/locale-path';
import { mountainPath } from '@/lib/platform/site/mountains/mountain-page';

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  return isSlug(slug) ? mountainMetadata(slug) : {};
}

/** /mountain/<slug>, from data/db/mountains.db; a slug whose mountain was merged into another moves for good. */
export default async function MountainRoute({ params }: Props) {
  const { slug } = await params;
  if (!isSlug(slug)) notFound();
  const found = await loadMountain(slug);
  if (!found) notFound();
  if ('redirect' in found) permanentRedirect(localePath((await requestLocale()).locale, mountainPath(found.redirect)));
  return <MountainPageView slug={slug} />;
}
