import Link from 'next/link';
import { Section, TEXT_LINK } from '@/components/site/pages/site-frame';
import { Notes } from '@/components/site/places/parts/notes';
import { chartWords } from '@/components/site/places/topics/lib/indicator-lines';
import { indicatorNotes } from '@/components/site/places/topics/lib/indicator-notes';
import { IndicatorTable } from '@/components/site/places/topics/parts/indicator-table';
import { measureTable } from '@/components/site/places/topics/parts/measure-chart';
import { Points } from '@/components/site/places/topics/parts/stat-tiles';
import type { Translate } from '@/lib/core/i18n/translator';
import { comparePath, type PairMeasure } from '@/lib/platform/site/compare/compare';
import { pairSentences } from '@/lib/platform/site/compare/compare-copy';
import type { CountryPair } from '@/lib/platform/site/compare/pairs';
import { worldPath } from '@/lib/platform/site/compare/world';
import { localePath } from '@/lib/platform/site/locale-path';
import { listOf } from '@/lib/platform/site/places/copy/format';
import { placePath } from '@/lib/platform/site/places/paths';
import { HEADLINE, HUB_SLUG } from '@/lib/platform/site/places/topics/indicators';
import { INDICATOR_GROUPS } from '@/lib/platform/site/places/topics/indicators-data';
import type { SiteText } from '@/lib/platform/site/text';
import { PairCard } from './pair-card';

const LAYERS = ['country-data-over-time'];

type Props = { text: SiteText; pair: CountryPair; names: [string, string]; measures: PairMeasure[] };

const href = (t: Translate, path: string) => localePath(t.locale, path);

/** Every measure the two share, under its group's name, each leading to its comparison. */
function PairGroups({ pair, names, measures, t, skip }: Omit<Props, 'text'> & { t: Translate; skip?: string }) {
  return (
    <div className="flex flex-col gap-8">
      {INDICATOR_GROUPS.map(g => {
        const inGroup = measures.filter(m => m.spec.group === g.id && m.spec.slug !== skip);
        if (!inGroup.length) return null;
        return (
          <section key={g.id}>
            <h3 className="text-[15px] font-semibold text-ink-1">{t(g.label)}</h3>
            <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {inGroup.map(m => <li key={m.spec.slug}><PairCard href={href(t, comparePath(pair, m.spec.slug))} names={names} m={m} t={t} /></li>)}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

/** Each country's own pages, and the measure around the world. */
function OwnPages({ pair, names, t, slug }: { pair: CountryPair; names: [string, string]; t: Translate; slug?: string }) {
  const links = [
    ...[pair.a, pair.b].map((p, i) => ({ path: placePath(p, slug ?? HUB_SLUG), label: slug ? names[i] : t('{place} in numbers', { place: names[i] }) })),
    ...(slug ? [{ path: worldPath(slug), label: t('Around the world') }] : []),
  ];
  return (
    <ul className="flex flex-wrap gap-x-6 gap-y-2 text-[14px]">
      {links.map(l => <li key={l.path}><Link href={href(t, l.path)} className={TEXT_LINK}>{l.label}</Link></li>)}
    </ul>
  );
}

export function PairOverviewHero({ pair, names, measures, t }: Omit<Props, 'text'> & { t: Translate }) {
  const shown = [...HEADLINE.flatMap(slug => measures.filter(m => m.spec.slug === slug)), ...measures.filter(m => !HEADLINE.includes(m.spec.slug))].slice(0, 4);
  return (
    <ul className="grid grid-cols-2 gap-3">
      {shown.map(m => <li key={m.spec.slug}><PairCard href={href(t, comparePath(pair, m.spec.slug))} names={names} m={m} t={t} big /></li>)}
    </ul>
  );
}

/** Every measure the two share, across the page's whole width; on a measure's page, the others. */
export function PairMeasureGrid({ text: { t }, pair, names, measures, skip }: Props & { skip?: string }) {
  return (
    <Section title={skip ? t('{a} vs {b}', { a: names[0], b: names[1] }) : t('Every measure')}>
      <PairGroups pair={pair} names={names} measures={measures} t={t} skip={skip} />
    </Section>
  );
}

export function PairOverviewBody({ text, pair, names, measures }: Props) {
  const { t } = text;
  const by = [...new Set(measures.map(m => m.spec.by))];
  return (
    <>
      <Section title={t('Each country on its own')}>
        <OwnPages pair={pair} names={names} t={t} />
      </Section>
      <Notes text={text} layers={LAYERS} notes={[
        t('Sources: {list}. Each measure’s page names its own and what it counts.', { list: listOf(by, t) }),
        t('Values are drawn on today’s borders. Years without a published value are left empty, never filled in.'),
      ]} />
    </>
  );
}

export function PairMeasureBody({ text, pair, names, m }: Omit<Props, 'measures'> & { m: PairMeasure }) {
  const { t } = text;
  const rest = pairSentences(pair, m, t).slice(2);
  const places = [{ label: names[0], series: m.a, slot: 0 }, { label: names[1], series: m.b, slot: 1 }];
  return (
    <>
      {rest.length > 0 && (
        <Section title={t('What the numbers say')}>
          <Points points={rest} />
        </Section>
      )}
      <Section title={t('Every year')}>
        <IndicatorTable year={t('Year')} words={chartWords(t)} {...measureTable(m.spec, places, m.meta?.world, t)} />
      </Section>
      <Section title={t('Each country on its own')}>
        <OwnPages pair={pair} names={names} t={t} slug={m.spec.slug} />
      </Section>
      <Notes text={text} layers={LAYERS} notes={indicatorNotes(m.spec, [m.a, m.b], m.meta, t)} />
    </>
  );
}
