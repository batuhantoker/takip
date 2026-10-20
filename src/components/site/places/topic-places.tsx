import Link from 'next/link';
import { cx, FOCUS_RING } from '@/components/ui/class-names';
import { Section } from '@/components/site/pages/site-frame';
import { localePath } from '@/lib/platform/site/locale-path';
import { countryName, nameOf } from '@/lib/platform/site/places/copy/format';
import { topicPlaces } from '@/lib/platform/site/places/pages';
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
      <ul className="grid gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
        {places.map(({ place, slug }) => (
          <li key={place.id} className="text-[14px]">
            <Link href={localePath(t.locale, placePath(place, slug))} className={cx('text-ink-1 hover:text-accent', FOCUS_RING)}>{nameOf(place, t)}</Link>
            {place.kind !== 'country' && <span className="text-ink-3"> · {countryName(place.cc, t)}</span>}
          </li>
        ))}
      </ul>
    </Section>
  );
}
