import type { Metadata } from 'next';
import { notFound, permanentRedirect, redirect } from 'next/navigation';
import { EventPageView, eventMetadata, loadEvent } from '@/components/site/events/event-page';
import { requestLocale } from '@/lib/core/i18n/request';
import { isSlug } from '@/lib/platform/site/events/slug';
import { eventPath } from '@/lib/platform/site/events/sitemap';
import { slugForEventId } from '@/lib/platform/site/events/event-page';
import { localePath } from '@/lib/platform/site/locale-path';

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  return isSlug(slug) ? eventMetadata(slug) : {};
}

/**
 * /event/<slug>. A bare number is a History event id, from the map's popups: it goes to that event's page for now,
 * since ids can change when history.db is rebuilt. A renamed or merged event's old slug moves for good.
 */
export default async function EventRoute({ params }: Props) {
  const { slug } = await params;
  const here = async (s: string) => localePath((await requestLocale()).locale, eventPath(s));
  if (/^\d{1,12}$/.test(slug)) {
    const found = slugForEventId(Number(slug));
    if (!found) notFound();
    redirect(await here(found));
  }
  if (!isSlug(slug)) notFound();
  const found = await loadEvent(slug);
  if (!found) notFound();
  if ('redirect' in found) permanentRedirect(await here(found.redirect));
  return <EventPageView slug={slug} />;
}
