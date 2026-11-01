import Link from 'next/link';
import { Fragment, type ReactNode } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { cx, FOCUS_RING, TRANSITION } from '@/components/ui/class-names';
import { localePath } from '@/lib/platform/site/locale-path';
import { crawlRel } from '@/lib/platform/site/meta';
import { listOf, nameOf } from '@/lib/platform/site/places/copy/format';
import { inNavOrder, placeIndexed, placePages, searched, topicPages, type PlacePageRef } from '@/lib/platform/site/places/pages';
import { km } from '@/lib/platform/site/places/gazetteer';
import { topicShown } from '@/lib/platform/site/places/topics/faith-reach';
import type { Place } from '@/lib/platform/site/places/place';
import { placePath } from '@/lib/platform/site/places/paths';
import type { SiteText } from '@/lib/platform/site/text';
import { TabRow } from './tab-row';

/** The place's listed pages, without those a topic's other page stands for. */
export const listedPages = (pages: PlacePageRef[]) => pages.filter(p => p.page.listed !== false);

/** Topics about what is moving there now: listed first, behind the live dot. */
const LIVE_TOPICS = new Set(['now', 'transit', 'cameras', 'flights', 'weather', 'ports']);

type NavItem = { href: string; label: string; here: boolean; rel?: string };

function Tab({ t, item }: { t: SiteText['t']; item: NavItem }) {
  return (
    <Link href={localePath(t.locale, item.href)} rel={item.rel} aria-current={item.here ? 'page' : undefined}
      className={cx('relative inline-flex h-11 shrink-0 items-center whitespace-nowrap px-3 text-[14px] font-medium', FOCUS_RING, TRANSITION,
        item.here ? 'text-ink-1' : 'text-ink-2 hover:text-ink-1')}>
      {item.label}
      {item.here && <span aria-hidden className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-accent" />}
    </Link>
  );
}

const Rule = () => <span aria-hidden className="mx-2 my-3.5 w-px shrink-0 bg-line-strong" />;

/**
 * The place's pages as one row of tabs that stays at the top while the page scrolls: its overview, the live topics,
 * then the rest. An unlisted page marks its topic's first. On a phone the row scrolls sideways.
 */
export function TopicNav({ text, place, pages, current }: { text: SiteText; place: Place; pages: PlacePageRef[]; current?: string }) {
  const { t } = text;
  const unlisted = pages.find(p => p.page.slug === current && p.page.listed === false)?.topic;
  const listed = inNavOrder(place, listedPages(pages));
  // A faith page is marked by the Prayers entry where that page lists it.
  const stands = unlisted && listed.find(p => p.topic.id === unlisted.id || (p.topic.faith && topicShown(place, unlisted.id)))?.page.slug;
  const item = (p: PlacePageRef): NavItem => ({
    href: placePath(place, p.page.slug), label: t(p.page.label ?? p.topic.label), here: p.page.slug === current || p.page.slug === stands, rel: crawlRel(searched(p)),
  });
  const live = listed.filter(p => LIVE_TOPICS.has(p.topic.id)).map(item);
  const rest = listed.filter(p => !LIVE_TOPICS.has(p.topic.id)).map(item);
  return (
    <nav aria-label={t('{city} on TAKIP', { city: nameOf(place, t) })} className="sticky top-0 z-20 mt-6 border-b border-line bg-surface-0/95 backdrop-blur">
      <TabRow className="relative -mx-3 flex overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <Tab t={t} item={{ href: placePath(place), label: t('Overview'), here: !current, rel: crawlRel(placeIndexed(place)) }} />
        {live.length > 0 && <Rule />}
        {live.length > 0 && <span role="img" aria-label={t('Live')} className="my-auto ml-1 size-1.5 shrink-0 rounded-full bg-green" />}
        {live.map(i => <Tab key={i.href} t={t} item={i} />)}
        {rest.length > 0 && <Rule />}
        {rest.map(i => <Tab key={i.href} t={t} item={i} />)}
      </TabRow>
      <span aria-hidden className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-surface-0 sm:hidden" />
    </nav>
  );
}

/** A plain card that leads to another page. */
export function LinkCard({ href, title, line, rel }: { href: string; title: string; line: string; rel?: string }) {
  return (
    <Link href={href} rel={rel} className={cx('group flex h-full flex-col gap-2 rounded-card border border-line bg-surface-1 p-4 hover:border-line-strong', FOCUS_RING, TRANSITION)}>
      <span className="flex items-center gap-2 text-[15px] font-semibold text-ink-1">
        <span className="flex-1">{title}</span>
        <ArrowUpRight className="size-4 text-ink-3 group-hover:text-ink-1" aria-hidden />
      </span>
      <span className="text-[13px] leading-relaxed text-ink-3">{line}</span>
    </Link>
  );
}

/** A line with its numbers in mono, as the reading pages set figures. */
export function WithFigures({ text }: { text: string }) {
  return text.split(/(\d[\d.,:\u00a0\u202f]*\d|\d)/).map((part, i) =>
    i % 2 ? <span key={i} className="font-mono tabular-nums">{part}</span> : part);
}

/** Other pages as a list split by hairlines: each row the link, its title and then one line about it. */
export function PageList({ items }: { items: { href: string; rel?: string; title: string; line: string }[] }) {
  return (
    <ul className="grid border-t border-line sm:grid-cols-2 sm:gap-x-10">
      {items.map(i => (
        <li key={i.href} className="border-b border-line">
          <Link href={i.href} rel={i.rel} className={cx('group block py-3.5', FOCUS_RING)}>
            <span className={cx('block text-[15px] leading-6 font-medium text-ink-1 group-hover:text-accent', TRANSITION)}>{i.title}</span>
            <span className="mt-0.5 block text-[13px] leading-5 text-ink-3"><WithFigures text={i.line} /></span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/**
 * Places near `from`, each with how far it is and what it has; to the same topic page when it has one. With `summary`,
 * a place says what that topic holds there instead of naming its pages.
 */
export function NearbyList({ text, places, from, page, summary }: { text: SiteText; places: Place[]; from: Place; page?: string; summary?: boolean }) {
  const { t } = text;
  return (
    <ul className="grid grid-cols-1 border-t border-line sm:grid-cols-2 sm:gap-x-8 lg:grid-cols-4">
      {places.map(p => {
        const pages = placePages(p).filter(x => x.page.index);
        const same = page ? pages.find(x => x.page.slug === page) : undefined;
        const labels = [...new Set(pages.filter(x => !x.topic.faith).map(x => t(x.topic.label)))];
        const fact = summary && same ? same.topic.summary(p, same.page, t) : listOf(labels, t);
        return (
          <li key={p.id} className="border-b border-line">
            <Link href={localePath(t.locale, placePath(p, same?.page.slug))} rel={crawlRel(same ? searched(same) : placeIndexed(p))} className={cx('group block py-2.5', FOCUS_RING)}>
              <span className={cx('block text-[14px] leading-5 font-medium text-ink-1 group-hover:text-accent', TRANSITION)}>{nameOf(p, t)}</span>
              <span className="mt-0.5 block text-[12px] leading-[18px] text-ink-3">
                <WithFigures text={[t('{km, distance} away', { km: km(from.at, p.at) }), fact].filter(Boolean).join(' · ')} />
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Many places as plain links, each with its population and the pages that set it apart: a topic most of the others
 * also have is counted, not named again under every place.
 */
export function PlaceList({ text, places }: { text: SiteText; places: Place[] }) {
  const { t } = text;
  const pagesOf = new Map(places.map(p => [p.id, topicPages(p)]));
  const held = new Map<string, number>();
  for (const pages of pagesOf.values()) for (const id of new Set(pages.map(x => x.topic.id))) held.set(id, (held.get(id) ?? 0) + 1);
  const rare = (id: string) => (held.get(id) ?? 0) <= places.length / 2;
  const people = new Intl.NumberFormat(t.intl, { notation: 'compact', maximumFractionDigits: 1 });
  return (
    <ul className="grid grid-cols-1 border-t border-line sm:grid-cols-2 sm:gap-x-8 lg:grid-cols-3">
      {places.map(p => {
        const pages = pagesOf.get(p.id) ?? [];
        const named = pages.filter(x => rare(x.topic.id)).slice(0, 2);
        const more = pages.length - named.length;
        const line: ReactNode[] = named.map((x, i) => (
          <Fragment key={x.topic.id}>
            {i > 0 && ', '}
            <Link href={localePath(t.locale, placePath(p, x.page.slug))} className={cx('hover:text-ink-1', FOCUS_RING)}>{t(x.topic.label)}</Link>
          </Fragment>
        ));
        return (
          <li key={p.id} className="flex flex-col gap-0.5 border-b border-line py-2.5">
            <span className="flex items-baseline justify-between gap-3">
              <Link href={localePath(t.locale, placePath(p))} rel={crawlRel(placeIndexed(p))} className={cx('truncate text-[15px] leading-6 font-medium text-ink-1 hover:text-accent', FOCUS_RING)}>{nameOf(p, t)}</Link>
              {p.pop > 0 && <span className="shrink-0 font-mono text-[12px] tabular-nums text-ink-3">{people.format(p.pop)}</span>}
            </span>
            {(named.length > 0 || more > 0) && (
              <span className="text-[13px] leading-5 text-ink-3">
                {line}
                {more > 0 && `${named.length ? ' · ' : ''}${t('{n, plural, one {# more page} other {# more pages}}', { n: more })}`}
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
