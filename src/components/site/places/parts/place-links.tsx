import Link from 'next/link';
import { ArrowUpRight, type LucideIcon } from 'lucide-react';
import { cx, FOCUS_RING, TRANSITION } from '@/components/ui/class-names';
import { localePath } from '@/lib/platform/site/locale-path';
import { countryName, nameOf } from '@/lib/platform/site/places/copy/format';
import { placePages, type PlacePageRef } from '@/lib/platform/site/places/pages';
import type { Place } from '@/lib/platform/site/places/place';
import { placePath } from '@/lib/platform/site/places/paths';
import type { SiteText } from '@/lib/platform/site/text';
import { TOPIC_VIEWS } from '../topics/registry';

/** The place's pages side by side: its overview and each topic page. */
export function TopicNav({ text: { t }, place, pages, current }: { text: SiteText; place: Place; pages: PlacePageRef[]; current?: string }) {
  const items: { href: string; label: string; here: boolean; Icon?: LucideIcon }[] = [
    { href: placePath(place), label: t('Overview'), here: !current },
    ...pages.map(p => ({ href: placePath(place, p.page.slug), label: t(p.topic.label), here: p.page.slug === current, Icon: TOPIC_VIEWS[p.topic.id]?.icon })),
  ];
  return (
    <nav aria-label={t('{city} on TAKIP', { city: nameOf(place, t) })} className="mt-6 flex flex-wrap gap-2">
      {items.map(({ href, label, here, Icon }) => (
        <Link key={href} href={localePath(t.locale, href)} aria-current={here ? 'page' : undefined}
          className={cx('inline-flex h-8 items-center gap-1.5 rounded-control border px-2.5 text-[13px]', FOCUS_RING, TRANSITION,
            here ? 'border-line-strong bg-surface-3 text-ink-1' : 'border-line bg-surface-1 text-ink-2 hover:text-ink-1')}>
          {Icon && <Icon className="size-3.5" aria-hidden />}{label}
        </Link>
      ))}
    </nav>
  );
}

/** A plain card that leads to another page. */
export function LinkCard({ href, title, line, Icon }: { href: string; title: string; line: string; Icon?: LucideIcon }) {
  return (
    <Link href={href} className={cx('group flex h-full flex-col gap-2 rounded-card border border-line bg-surface-1 p-4 hover:border-line-strong', FOCUS_RING, TRANSITION)}>
      <span className="flex items-center gap-2 text-[15px] font-semibold text-ink-1">
        {Icon && <Icon className="size-4 text-ink-3" aria-hidden />}
        <span className="flex-1">{title}</span>
        <ArrowUpRight className="size-4 text-ink-3 group-hover:text-ink-1" aria-hidden />
      </span>
      <span className="text-[13px] leading-relaxed text-ink-3">{line}</span>
    </Link>
  );
}

/** Other places, each as a card naming its region and its indexed pages; to the same topic page when it has one. */
export function PlaceCards({ text: { t }, places, page }: { text: SiteText; places: Place[]; page?: string }) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {places.map(p => {
        const pages = placePages(p).filter(x => x.page.index);
        const to = page && pages.some(x => x.page.slug === page) ? page : undefined;
        return (
          <li key={p.id}>
            <LinkCard href={localePath(t.locale, placePath(p, to))} title={nameOf(p, t)}
              line={`${p.region ?? countryName(p.cc, t)} · ${pages.map(x => t(x.topic.label)).join(', ')}`} />
          </li>
        );
      })}
    </ul>
  );
}

/** Many places as plain links, each with what its page covers. */
export function PlaceList({ text: { t }, places }: { text: SiteText; places: Place[] }) {
  return (
    <ul className="grid gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
      {places.map(p => (
        <li key={p.id} className="text-[14px]">
          <Link href={localePath(t.locale, placePath(p))} className={cx('text-ink-1 hover:text-accent', FOCUS_RING)}>{nameOf(p, t)}</Link>
          <span className="text-ink-3"> · {placePages(p).filter(x => x.page.index).map(x => t(x.topic.label)).join(', ')}</span>
        </li>
      ))}
    </ul>
  );
}
