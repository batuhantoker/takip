import { Landmark } from 'lucide-react';
import type { Locale } from '@/lib/core/i18n/locales';
import Link from 'next/link';
import { Section, TEXT_LINK } from '@/components/site/pages/site-parts';
import { cx, FOCUS_RING, TRANSITION } from '@/components/ui/class-names';
import { viewPath } from '@/lib/map/view-link';
import { GROUP_COLOR } from '@/lib/places/attractions/map-layers';
import type { Photo } from '@/lib/places/attractions/photos';
import { localePath } from '@/lib/platform/site/locale-path';
import { crawlRel } from '@/lib/platform/site/meta';
import { nameOf } from '@/lib/platform/site/places/copy/format';
import { placeById } from '@/lib/platform/site/places/gazetteer';
import { placeIndexed, placePages } from '@/lib/platform/site/places/pages';
import { placePath } from '@/lib/platform/site/places/paths';
import type { Place } from '@/lib/platform/site/places/place';
import type { AttractionEntry, AttractionsData } from '@/lib/platform/site/places/topics/attractions';
import { attractionName, attractionWiki, groupOf, KIND_GROUPS, KIND_LABEL, type AttractionItem } from '@/lib/platform/site/places/topics/attractions-data';
import type { SiteText } from '@/lib/platform/site/text';
import { Notes } from '../parts/notes';
import { DayTrips } from './parts/day-trips';
import { PhotoCredits, PhotoThumb, type Photos } from './parts/photos';
import type { TopicView } from './view';

/** The place's other pages that are something to do there too, in this order. */
const ALSO = ['hiking', 'cameras', 'iss', 'aurora', 'sun', 'transit', 'ports'];

function Entry({ text, place, entry, photo, kind }: { text: SiteText; place: Place; entry: AttractionEntry; photo?: Photo; kind: boolean }) {
  const { t } = text;
  const { id, item } = entry;
  const city = entry.city ? placeById(entry.city) : undefined;
  const where = entry.km !== undefined
    ? t('{km, distance} from the centre', { km: entry.km })
    : city ? nameOf(city, t) : null;
  return (
    <li className="flex items-center gap-4 py-2.5" {...mapRow(id, item, t.locale)}>
      <PhotoThumb photo={photo} />
      <span className="flex min-w-0 flex-col gap-0.5">
      <span className="flex flex-wrap items-baseline gap-x-2">
        <a href={attractionWiki(id, item, t.locale)} target="_blank" rel="noopener" className={cx(TEXT_LINK, 'text-[15px] font-medium')}>{attractionName(item, t.locale)}</a>
        {item.h && <span className="rounded-control border border-line px-1.5 py-0.5 text-[11px] font-medium text-ink-3">{t('World Heritage')}</span>}
      </span>
      <span className="text-[13px] text-ink-3">
        {[kind && t(KIND_LABEL[item.k]), where].filter(Boolean).join(' · ')}
        {' · '}
        <a href={viewPath({ lat: item.at[1], lng: item.at[0], zoom: place.kind === 'country' ? 13 : 15, layers: { things_to_do: true } })}
          data-map-jump={place.kind === 'country' ? 13 : 15} className="hover:text-ink-1">{t('On the map')}</a>
      </span>
      </span>
    </li>
  );
}

/** What the page's live map reads off a row to mark it (components/site/pages/map-talk.ts). */
export const mapRow = (id: string, item: AttractionItem, locale: Locale) =>
  ({ 'data-map': `${item.at[0]},${item.at[1]}`, 'data-map-id': id, 'data-map-label': attractionName(item, locale) });

/** The place's best known few, numbered, for its overview. */
function TopFew({ text, entries }: { text: SiteText; entries: AttractionEntry[] }) {
  const { t } = text;
  return (
    <ol className="grid gap-x-8 sm:grid-cols-2">
      {entries.map((e, i) => {
        const city = e.city ? placeById(e.city) : undefined;
        const where = e.km !== undefined ? t('{km, distance} from the centre', { km: e.km }) : city ? nameOf(city, t) : null;
        return (
          <li key={e.id} className="flex items-baseline gap-3 border-b border-line py-3" {...mapRow(e.id, e.item, t.locale)}>
            <span className="w-5 shrink-0 font-mono text-[13px] tabular-nums text-ink-3">{i + 1}</span>
            <span className="flex min-w-0 flex-col gap-0.5">
              <a href={attractionWiki(e.id, e.item, t.locale)} target="_blank" rel="noopener" className={cx(TEXT_LINK, 'text-[15px] font-medium')}>{attractionName(e.item, t.locale)}</a>
              <span className="flex items-center gap-1.5 text-[13px] text-ink-3">
                <span aria-hidden className="size-1.5 shrink-0 rounded-full" style={{ background: GROUP_COLOR[groupOf(e.item.k)] }} />
                {[t(KIND_LABEL[e.item.k]), where].filter(Boolean).join(' · ')}
              </span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

const OVERVIEW_FEW = 6;

/** The sections with something in them, the one holding the best-known place first. */
function groupsByFame(entries: AttractionEntry[]) {
  return KIND_GROUPS.map(group => ({ group, entries: entries.filter(e => group.kinds.includes(e.item.k)) }))
    .filter(g => g.entries.length > 0)
    .sort((a, b) => b.entries[0].item.l - a.entries[0].item.l);
}

const HIGHLIGHTS = 6;

export const ATTRACTIONS_VIEW: TopicView<AttractionsData, never, Photos> = {
  icon: Landmark,
  overviewFirst: true,
  mapBeside: true,

  Overview({ text, place, page }) {
    const { t } = text;
    const { entries } = page.data;
    const plans = placePages(place).filter(p => p.topic.id === 'plans');
    const links = [
      { href: placePath(place, page.slug), label: t('All {n, plural, one {# place} other {# places}} to see', { n: entries.length }), rel: crawlRel(page.index) },
      ...plans.map(p => ({ href: placePath(place, p.page.slug), label: p.topic.header(place, p.page, t).heading, rel: crawlRel(p.page.index) })),
    ];
    return (
      <Section title={place.kind === 'country' ? t('Things to do in {country}', { country: nameOf(place, t) }) : t('Things to do in {city}', { city: nameOf(place, t) })}>
        <TopFew text={text} entries={entries.slice(0, OVERVIEW_FEW)} />
        <p className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-[14px]">
          {links.map(l => (
            <Link key={l.href} href={localePath(t.locale, l.href)} rel={l.rel} className={cx(TEXT_LINK, 'font-medium')}>{l.label}</Link>
          ))}
        </p>
        <DayTrips text={text} place={place} />
      </Section>
    );
  },

  Wide({ text, place, page: { data }, detail }) {
    const { t } = text;
    const shown = data.entries.filter(e => detail?.[e.id]).slice(0, HIGHLIGHTS);
    if (shown.length < 3) return null;
    return (
      <Section title={place.kind === 'country' ? t('Top attractions in {country}', { country: nameOf(place, t) }) : t('Top attractions in {city}', { city: nameOf(place, t) })}>
      <ul className="grid grid-cols-2 gap-x-4 gap-y-6 lg:grid-cols-3">
        {shown.map(e => {
          const photo = detail![e.id];
          const city = e.city ? placeById(e.city) : undefined;
          return (
            <li key={e.id} {...mapRow(e.id, e.item, t.locale)}>
              <a href={attractionWiki(e.id, e.item, t.locale)} target="_blank" rel="noopener" className={cx('group block', FOCUS_RING)}>
                {/* eslint-disable-next-line @next/next/no-img-element -- Wikimedia's own scaled copy; credited in the page's Photo credits. */}
                <img src={photo.src} alt={attractionName(e.item, t.locale)} loading="lazy" decoding="async"
                  className="aspect-[4/3] w-full rounded-card bg-surface-2 object-cover transition-opacity duration-150 group-hover:opacity-90 motion-reduce:transition-none" />
                <span className="mt-2.5 block text-[15px] font-medium text-ink-1">{attractionName(e.item, t.locale)}</span>
              </a>
              <span className="mt-0.5 flex items-center gap-1.5 text-[13px] text-ink-3">
                <span aria-hidden className="size-1.5 shrink-0 rounded-full" style={{ background: GROUP_COLOR[groupOf(e.item.k)] }} />
                {[t(KIND_LABEL[e.item.k]), e.km !== undefined ? t('{km, distance} from the centre', { km: e.km }) : city && nameOf(city, t)].filter(Boolean).join(' · ')}
              </span>
            </li>
          );
        })}
      </ul>
      </Section>
    );
  },

  Body({ text, place, page: { data }, detail }) {
    const { t } = text;
    const name = nameOf(place, t);
    const also = placePages(place).filter(p => ALSO.includes(p.topic.id) && p.page.listed !== false)
      .sort((a, b) => ALSO.indexOf(a.topic.id) - ALSO.indexOf(b.topic.id));
    return (
      <>
        {groupsByFame(data.entries).map(({ group, entries }) => (
          <Section key={group.id} title={t(group.label)}>
            <ul className="divide-y divide-line">
              {entries.map(e => <Entry key={e.id} text={text} place={place} entry={e} photo={detail?.[e.id]} kind={group.kinds.length > 1} />)}
            </ul>
          </Section>
        ))}
        {also.length > 0 && (
          <Section title={t('More to do in {place} with TAKIP', { place: name })}>
            <ul className="grid gap-3 sm:grid-cols-2">
              {also.map(({ topic, page }) => (
                <li key={`${topic.id}/${page.slug}`}>
                  <Link href={localePath(t.locale, placePath(place, page.slug))} rel={crawlRel(placeIndexed(place, page.slug))}
                    className={cx('block h-full rounded-card border border-line bg-surface-1 p-4 hover:bg-surface-2', FOCUS_RING, TRANSITION)}>
                    <span className="block text-[15px] font-medium text-ink-1">{t(page.label ?? topic.label)}</span>
                    <span className="mt-1 block text-[14px] leading-relaxed text-ink-2">{topic.summary(place, page, t)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </Section>
        )}
        <DayTrips text={text} place={place} />
        <PhotoCredits text={text} credits={data.entries.flatMap(e => (detail?.[e.id] ? [{ name: attractionName(e.item, t.locale), photo: detail[e.id] }] : []))} />
        <Notes text={text} layers={[]} notes={[
          t('The list comes from Wikidata (CC0): museums, castles, palaces, cathedrals, parks, gardens, zoos, squares, monuments and other landmarks with their own articles in at least three Wikipedias, the best known first.'),
          place.kind === 'country'
            ? t('Each place counts for the city it lies closest to by size and distance; the country lists its best known.')
            : t('Each place counts for one city, the one closest to it by size and distance, so nearby towns don’t repeat it.'),
          t('There are no opening hours, tickets or pictures here: the Wikipedia article for each has them.'),
        ]} />
      </>
    );
  },
};
