import Link from 'next/link';
import { Fragment } from 'react';
import { ArrowUpRight, type LucideIcon } from 'lucide-react';
import { cx, FOCUS_RING, TRANSITION } from '@/components/ui/class-names';
import { localePath } from '@/lib/platform/site/locale-path';
import { crawlRel } from '@/lib/platform/site/meta';
import { countryName, nameOf } from '@/lib/platform/site/places/copy/format';
import { inNavOrder, placeIndexed, placePages, topicPages, type PlacePageRef } from '@/lib/platform/site/places/pages';
import { km, regionLabel } from '@/lib/platform/site/places/gazetteer';
import { topicShown } from '@/lib/platform/site/places/topics/faith-reach';
import type { Place } from '@/lib/platform/site/places/place';
import { placePath } from '@/lib/platform/site/places/paths';
import type { SiteText } from '@/lib/platform/site/text';
import { TOPIC_VIEWS } from '../topics/registry';

/** The place's listed pages, without those a topic's other page stands for. */
export const listedPages = (pages: PlacePageRef[]) => pages.filter(p => p.page.listed !== false);

/** The place's pages side by side: its overview and each listed topic page; an unlisted page marks its topic's first. */
export function TopicNav({ text, place, pages, current }: { text: SiteText; place: Place; pages: PlacePageRef[]; current?: string }) {
  const { t } = text;
  const unlisted = pages.find(p => p.page.slug === current && p.page.listed === false)?.topic;
  const listed = inNavOrder(place, listedPages(pages));
  // A faith page is marked by the Prayers entry where that page lists it.
  const stands = unlisted && listed.find(p => p.topic.id === unlisted.id || (p.topic.faith && topicShown(place, unlisted.id)))?.page.slug;
  const items: { href: string; label: string; here: boolean; rel?: string; Icon?: LucideIcon }[] = [
    { href: placePath(place), label: t('Overview'), here: !current, rel: crawlRel(placeIndexed(place)) },
    ...listed.map(p => ({
      href: placePath(place, p.page.slug), label: t(p.page.label ?? p.topic.label), here: p.page.slug === current || p.page.slug === stands,
      rel: crawlRel(p.page.index), Icon: TOPIC_VIEWS[p.topic.id]?.icon,
    })),
  ];
  return (
    <nav aria-label={t('{city} on TAKIP', { city: nameOf(place, t) })} className="mt-6 flex flex-wrap gap-2">
      {items.map(({ href, label, here, rel, Icon }) => (
        <Link key={href} href={localePath(t.locale, href)} rel={rel} aria-current={here ? 'page' : undefined}
          className={cx('inline-flex h-8 items-center gap-1.5 rounded-control border px-2.5 text-[13px]', FOCUS_RING, TRANSITION,
            here ? 'border-line-strong bg-surface-3 text-ink-1' : 'border-line bg-surface-1 text-ink-2 hover:text-ink-1')}>
          {Icon && <Icon className="size-3.5" aria-hidden />}{label}
        </Link>
      ))}
    </nav>
  );
}

/** A plain card that leads to another page. */
export function LinkCard({ href, title, line, rel, Icon }: { href: string; title: string; line: string; rel?: string; Icon?: LucideIcon }) {
  return (
    <Link href={href} rel={rel} className={cx('group flex h-full flex-col gap-2 rounded-card border border-line bg-surface-1 p-4 hover:border-line-strong', FOCUS_RING, TRANSITION)}>
      <span className="flex items-center gap-2 text-[15px] font-semibold text-ink-1">
        {Icon && <Icon className="size-4 text-ink-3" aria-hidden />}
        <span className="flex-1">{title}</span>
        <ArrowUpRight className="size-4 text-ink-3 group-hover:text-ink-1" aria-hidden />
      </span>
      <span className="text-[13px] leading-relaxed text-ink-3">{line}</span>
    </Link>
  );
}

/**
 * Other places, each as a card naming its region and its indexed pages; to the same topic page when it has one. With
 * `from`, a card on that page's topic says what the topic holds there and how far it is instead.
 */
export function PlaceCards({ text, places, page, from }: { text: SiteText; places: Place[]; page?: string; from?: Place }) {
  const { t } = text;
  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {places.map(p => {
        const pages = placePages(p).filter(x => x.page.index);
        const named = pages.filter(x => !x.topic.faith);
        const same = page ? pages.find(x => x.page.slug === page) : undefined;
        const region = regionLabel(p, t.locale) ?? countryName(p.cc, t);
        const line = from && same
          ? `${region} · ${t('{km, distance} away', { km: km(from.at, p.at) })} · ${same.topic.summary(p, same.page, t)}`
          : `${region} · ${[...new Set(named.map(x => t(x.topic.label)))].join(', ')}`;
        return (
          <li key={p.id}>
            <LinkCard href={localePath(t.locale, placePath(p, same?.page.slug))} rel={crawlRel(!!same || placeIndexed(p))} title={nameOf(p, t)} line={line} />
          </li>
        );
      })}
    </ul>
  );
}

/** Many places as plain links, each with its topics linked to their pages there. */
export function PlaceList({ text, places }: { text: SiteText; places: Place[] }) {
  const { t } = text;
  return (
    <ul className="grid gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
      {places.map(p => (
        <li key={p.id} className="text-[14px]">
          <Link href={localePath(t.locale, placePath(p))} rel={crawlRel(placeIndexed(p))} className={cx('text-ink-1 hover:text-accent', FOCUS_RING)}>{nameOf(p, t)}</Link>
          <span className="text-ink-3"> · {topicPages(p).map((x, i) => (
            <Fragment key={x.topic.id}>
              {i > 0 && ', '}
              <Link href={localePath(t.locale, placePath(p, x.page.slug))} className={cx('hover:text-ink-1', FOCUS_RING)}>{t(x.topic.label)}</Link>
            </Fragment>
          ))}</span>
        </li>
      ))}
    </ul>
  );
}
