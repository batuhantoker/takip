import Link from 'next/link';
import { cx, FOCUS_RING, TRANSITION } from '@/components/ui/class-names';
import { Section } from '@/components/site/pages/site-frame';
import { localePath } from '@/lib/platform/site/locale-path';
import { crawlRel } from '@/lib/platform/site/meta';
import { countryName, nameOf } from '@/lib/platform/site/places/copy/format';
import { placeIndexed, topicPlaces } from '@/lib/platform/site/places/pages';
import { placePath } from '@/lib/platform/site/places/paths';
import { TOPICS } from '@/lib/platform/site/places/topics/registry';
import type { SiteText } from '@/lib/platform/site/text';

/** On a layer's page, the biggest places with a page of the topic that is the layer close up, each linked to it. */
export function TopicPlaces({ text, topicId }: { text: SiteText; topicId: string }) {
  const { t } = text;
  const topic = TOPICS.find(x => x.id === topicId);
  const places = topic ? topicPlaces(topic.id) : [];
  if (!topic || !places.length) return null;
  return (
    <Section title={t('{topic}, place by place', { topic: t(topic.label) })}>
      <ul className="grid grid-cols-1 border-t border-line sm:grid-cols-2 sm:gap-x-8 lg:grid-cols-3">
        {places.map(({ place, slug }) => (
          <li key={place.id} className="border-b border-line">
            <Link href={localePath(t.locale, placePath(place, slug))} rel={crawlRel(placeIndexed(place, slug))} className={cx('group flex items-baseline justify-between gap-3 py-2.5', FOCUS_RING)}>
              <span className={cx('truncate text-[15px] leading-6 font-medium text-ink-1 group-hover:text-accent', TRANSITION)}>{nameOf(place, t)}</span>
              {place.kind !== 'country' && <span className="shrink-0 text-[13px] text-ink-3">{countryName(place.cc, t)}</span>}
            </Link>
          </li>
        ))}
      </ul>
    </Section>
  );
}
