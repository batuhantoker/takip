import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { CraftPageView, craftMetadata, loadCraft } from '@/components/site/space/craft-page';
import { requestLocale } from '@/lib/core/i18n/request';
import { localePath } from '@/lib/platform/site/locale-path';
import { craftByHorizons, craftPath } from '@/lib/platform/site/space/roster';

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return craftMetadata((await params).slug);
}

/** /spacecraft/<slug>. A bare Horizons ID (-76) goes to that craft's page. */
export default async function SpacecraftRoute({ params }: Props) {
  const { slug } = await params;
  if (/^-\d{1,9}$/.test(slug)) {
    const craft = craftByHorizons(Number(slug));
    if (!craft) notFound();
    redirect(localePath((await requestLocale()).locale, craftPath(craft)));
  }
  if (!(await loadCraft(slug))) notFound();
  return <CraftPageView slug={slug} />;
}
