import { Landmark } from 'lucide-react';
import Link from 'next/link';
import { Section, TEXT_LINK } from '@/components/site/pages/site-parts';
import { cx, FOCUS_RING, TRANSITION } from '@/components/ui/class-names';
import { viewPath } from '@/lib/map/view-link';
import { localePath } from '@/lib/platform/site/locale-path';
import { nameOf } from '@/lib/platform/site/places/copy/format';
import { placeById } from '@/lib/platform/site/places/gazetteer';
import { placePages } from '@/lib/platform/site/places/pages';
import { placePath } from '@/lib/platform/site/places/paths';
import type { Place } from '@/lib/platform/site/places/place';
import { attractionName, attractionWiki, KIND_LABEL, type AttractionEntry, type AttractionsData } from '@/lib/platform/site/places/topics/attractions';
import { KIND_GROUPS } from '@/lib/platform/site/places/topics/attractions-data';
import type { SiteText } from '@/lib/platform/site/text';
import { Notes } from '../parts/notes';
import type { TopicView } from './view';

/** The place's other pages that are something to do there too, in this order. */
const ALSO = ['hiking', 'cameras', 'iss', 'aurora', 'sun', 'transit', 'ports'];

function Entry({ text, place, entry }: { text: SiteText; place: Place; entry: AttractionEntry }) {
  const { t } = text;
  const { id, item } = entry;
  const city = entry.city ? placeById(entry.city) : undefined;
  const where = entry.km !== undefined
    ? t('{km, distance} from the centre', { km: entry.km })
    : city ? nameOf(city, t) : null;
  return (
    <li className="flex flex-col gap-0.5 py-2.5">
      <span className="flex flex-wrap items-baseline gap-x-2">
        <a href={attractionWiki(id, item, t.locale)} target="_blank" rel="noopener" className={cx(TEXT_LINK, 'text-[15px] font-medium')}>{attractionName(item, t.locale)}</a>
        {item.h && <span className="rounded-control border border-line px-1.5 py-0.5 text-[11px] font-medium text-ink-3">{t('World Heritage')}</span>}
      </span>
      <span className="text-[13px] text-ink-3">
        {[t(KIND_LABEL[item.k]), where].filter(Boolean).join(' · ')}
        {' · '}
        <a href={viewPath({ lat: item.at[1], lng: item.at[0], zoom: place.kind === 'country' ? 13 : 15, layers: {} })} className="hover:text-ink-1">{t('On the map')}</a>
      </span>
    </li>
  );
}

/** The sections with something in them, the one holding the best-known place first. */
function groupsByFame(entries: AttractionEntry[]) {
  return KIND_GROUPS.map(group => ({ group, entries: entries.filter(e => group.kinds.includes(e.item.k)) }))
    .filter(g => g.entries.length > 0)
    .sort((a, b) => b.entries[0].item.l - a.entries[0].item.l);
}

export const ATTRACTIONS_VIEW: TopicView<AttractionsData> = {
  icon: Landmark,

  Body({ text, place, page: { data } }) {
    const { t } = text;
    const name = nameOf(place, t);
    const also = placePages(place).filter(p => ALSO.includes(p.topic.id) && p.page.listed !== false)
      .sort((a, b) => ALSO.indexOf(a.topic.id) - ALSO.indexOf(b.topic.id));
    return (
      <>
        {groupsByFame(data.entries).map(({ group, entries }) => (
          <Section key={group.id} title={t(group.label)}>
            <ul className="divide-y divide-line">
              {entries.map(e => <Entry key={e.id} text={text} place={place} entry={e} />)}
            </ul>
          </Section>
        ))}
        {also.length > 0 && (
          <Section title={t('More to do in {place} with TAKIP', { place: name })}>
            <ul className="grid gap-3 sm:grid-cols-2">
              {also.map(({ topic, page }) => (
                <li key={`${topic.id}/${page.slug}`}>
                  <Link href={localePath(t.locale, placePath(place, page.slug))}
                    className={cx('block h-full rounded-card border border-line bg-surface-1 p-4 hover:bg-surface-2', FOCUS_RING, TRANSITION)}>
                    <span className="block text-[15px] font-medium text-ink-1">{t(page.label ?? topic.label)}</span>
                    <span className="mt-1 block text-[14px] leading-relaxed text-ink-2">{topic.summary(place, page, t)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </Section>
        )}
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
