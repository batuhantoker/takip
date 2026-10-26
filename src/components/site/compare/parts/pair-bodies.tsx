import Link from 'next/link';
import { Section, TEXT_LINK } from '@/components/site/pages/site-frame';
import { Notes } from '@/components/site/places/parts/notes';
import { chartWords } from '@/components/site/places/topics/lib/indicator-lines';
import { indicatorNotes } from '@/components/site/places/topics/lib/indicator-notes';
import { IndicatorTable } from '@/components/site/places/topics/parts/indicator-table';
import { measureTable } from '@/components/site/places/topics/parts/measure-chart';
import { Points } from '@/components/site/places/topics/parts/stat-tiles';
import type { Translate } from '@/lib/core/i18n/translator';
import type { PairMeasure } from '@/lib/platform/site/compare/compare';
import { pairParts } from '@/lib/platform/site/compare/compare-copy';
import type { CountryPair } from '@/lib/platform/site/compare/pairs';
import { worldPath } from '@/lib/platform/site/compare/world';
import { localePath } from '@/lib/platform/site/locale-path';
import { listOf } from '@/lib/platform/site/places/copy/format';
import type { Place } from '@/lib/platform/site/places/place';
import { placePath } from '@/lib/platform/site/places/paths';
import { HUB_SLUG } from '@/lib/platform/site/places/topics/indicators';
import type { SiteText } from '@/lib/platform/site/text';
import type { Entry } from './compare-chart';
import { LatestTable } from './latest-table';

const LAYERS = ['country-data-over-time'];

const href = (t: Translate, path: string) => localePath(t.locale, path);

/** Each country's own pages, and the measure around the world. */
function OwnPages({ places, names, t, slug }: { places: Place[]; names: string[]; t: Translate; slug?: string }) {
  const links = [
    ...places.map((p, i) => ({ path: placePath(p, slug ?? HUB_SLUG), label: slug ? names[i] : t('{place} in numbers', { place: names[i] }) })),
    ...(slug ? [{ path: worldPath(slug), label: t('Around the world') }] : []),
  ];
  return (
    <ul className="flex flex-wrap gap-x-6 gap-y-2 text-[14px]">
      {links.map(l => <li key={l.path}><Link href={href(t, l.path)} className={TEXT_LINK}>{l.label}</Link></li>)}
    </ul>
  );
}

export function PairOverviewBody({ text, places, names, measures }: { text: SiteText; places: Place[]; names: string[]; measures: PairMeasure[] }) {
  const { t } = text;
  const by = [...new Set(measures.map(m => m.spec.by))];
  return (
    <>
      <Section title={t('Each country on its own')}>
        <OwnPages places={places} names={names} t={t} />
      </Section>
      <Notes text={text} layers={LAYERS} notes={[
        t('Sources: {list}. Each measure’s page names its own and what it counts.', { list: listOf(by, t) }),
        t('Values are drawn on today’s borders. Years without a published value are left empty, never filled in.'),
      ]} />
    </>
  );
}

/** A measure's figures under its chart; the pair's own sentences, past what the answer above says, only while just the two are compared. */
export function PairMeasureBody({ text, pair, places, entries, m }: { text: SiteText; pair: CountryPair; places: Place[]; entries: Entry[]; m: PairMeasure }) {
  const { t } = text;
  const rest = places.length === 2 ? pairParts(pair, m, t).rest : [];
  const charted = entries.flatMap(e => (e.series ? [{ label: e.label, series: e.series, slot: e.slot }] : []));
  return (
    <>
      <Section title={t('Latest figures')}>
        <LatestTable spec={m.spec} rows={entries} meta={m.meta} t={t} />
      </Section>
      {rest.length > 0 && (
        <Section title={t('What the numbers say')}>
          <Points points={rest} />
        </Section>
      )}
      <Section title={t('Every year')}>
        <IndicatorTable year={t('Year')} words={chartWords(t)} {...measureTable(m.spec, charted, m.meta?.world, t)} />
      </Section>
      <Section title={t('Each country on its own')}>
        <OwnPages places={places.filter((_, i) => entries[i].series)} names={entries.flatMap(e => (e.series ? [e.label] : []))} t={t} slug={m.spec.slug} />
      </Section>
      <Notes text={text} layers={LAYERS} notes={indicatorNotes(m.spec, charted.map(c => c.series), m.meta, t)} />
    </>
  );
}
