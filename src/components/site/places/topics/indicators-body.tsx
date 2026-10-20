import { ChartLine as ChartIcon } from 'lucide-react';
import Link from 'next/link';
import { Section, TEXT_LINK } from '@/components/site/pages/site-frame';
import type { Translate } from '@/lib/core/i18n/translator';
import { SERIES_INK } from '@/lib/map/style/tokens';
import { localePath } from '@/lib/platform/site/locale-path';
import { listOf, nameOf } from '@/lib/platform/site/places/copy/format';
import type { Place } from '@/lib/platform/site/places/place';
import { placePath } from '@/lib/platform/site/places/paths';
import type { TopicPage } from '@/lib/platform/site/places/topic';
import { HEADLINE, HUB_SLUG, INDICATOR_TOPIC, type IndicatorData, type IndicatorMeasure } from '@/lib/platform/site/places/topics/indicators';
import { basisOf, formatNumber, formatValue, indicatorSentences } from '@/lib/platform/site/places/topics/indicators-facts';
import { comparePath } from '@/lib/platform/site/compare/compare';
import { comparedWith } from '@/lib/platform/site/compare/pairs';
import { worldPath } from '@/lib/platform/site/compare/world';
import { indicatorRow, worldSeries } from '@/lib/platform/site/places/topics/indicators-table';
import { Notes } from '../parts/notes';
import { chartWords, tickFormat } from './lib/indicator-lines';
import { indicatorNotes } from './lib/indicator-notes';
import { IndicatorChart } from './parts/indicator-chart';
import { MeasureCard, MeasureGroups } from './parts/indicator-list';
import { IndicatorTable } from './parts/indicator-table';
import { MeasureChartCard, measureColumns } from './parts/measure-chart';

/** As many partners as a measure page links to. */
const MAX_PARTNERS = 8;
import type { TopicView } from './view';

function MeasureChart({ place, m, t }: { place: Place; m: IndicatorMeasure; t: Translate }) {
  const name = nameOf(place, t);
  return (
    <MeasureChartCard id={`chart-${m.spec.slug}`} spec={m.spec} places={[{ label: name, series: m.series, slot: 0 }]} world={worldSeries(m.spec.slug)} t={t}
      title={t('{metric} in {place}', { metric: t(m.spec.label), place: name })} desc={indicatorSentences(m.spec, m.series, m.meta, name, t).slice(0, 2).join(' ')} />
  );
}

/** The long run in its own unit, under its own name (Maddison asks for its citation wherever its numbers show). */
function LongRun({ place, m, t }: { place: Place; m: IndicatorMeasure; t: Translate }) {
  const run = m.spec.longRun;
  if (!run || !m.series.l) return null;
  const spec = { style: 'number' as const };
  const name = nameOf(place, t);
  return (
    <Section title={t('The long run, in {unit}', { unit: t(run.unit) })}>
      <div className="rounded-card border border-line bg-surface-1 p-4 sm:p-5">
        <IndicatorChart id={`chart-${m.spec.slug}-long`} size="body" lines={[{ key: 'long', label: name, ink: SERIES_INK[0], e: m.series.l }]}
          legend={[{ label: t('Estimates, {by}', { by: run.by }), ink: SERIES_INK[0], mark: 'line' }]}
          title={t('{metric} in {place}', { metric: t(m.spec.label), place: name })} desc={run.credit}
          tick={tickFormat(spec, t)} value={v => formatNumber(v, 'number', 0, t)} words={chartWords(t)} />
      </div>
      <p className="mt-3 text-[12px] leading-relaxed text-ink-3">{run.credit}</p>
    </Section>
  );
}

/** Links to the same measure for the countries this one is compared with, and around the world. */
function CompareLinks({ place, m, t }: { place: Place; m: IndicatorMeasure; t: Translate }) {
  const partners = comparedWith(place).filter(p => indicatorRow(p.id)?.m[m.spec.slug]).slice(0, MAX_PARTNERS);
  const metric = t(m.spec.label);
  return (
    <Section title={t('{metric} beside other countries', { metric })}>
      {partners.length > 0 && (
        <ul className="mb-5 grid gap-x-6 gap-y-2 sm:grid-cols-2">
          {partners.map(p => (
            <li key={p.id} className="text-[14px]">
              <Link href={localePath(t.locale, comparePath({ a: place, b: p }, m.spec.slug))} className={TEXT_LINK}>{t('{a} vs {b}', { a: nameOf(place, t), b: nameOf(p, t) })}</Link>
            </li>
          ))}
        </ul>
      )}
      <Link href={localePath(t.locale, worldPath(m.spec.slug))} className={TEXT_LINK}>{t('{metric} around the world', { metric })}</Link>
    </Section>
  );
}

function MeasureBody({ place, m, t }: { place: Place; m: IndicatorMeasure; t: Translate }) {
  const name = nameOf(place, t);
  const rest = indicatorSentences(m.spec, m.series, m.meta, name, t).slice(2);
  const hub = INDICATOR_TOPIC.pages(place).find(p => p.slug === HUB_SLUG)?.data;
  const others = hub?.kind === 'hub' ? hub.measures : [];
  return (
    <>
      {rest.length > 0 && (
        <Section title={t('What the numbers say')}>
          <p className="text-[15px] leading-relaxed text-ink-2">{rest.join(' ')}</p>
        </Section>
      )}
      <LongRun place={place} m={m} t={t} />
      <Section title={t('Every year')}>
        <IndicatorTable summary={t('Show the values year by year')} year={t('Year')} value={v => formatValue(m.spec, v, t)} words={chartWords(t)}
          columns={measureColumns(m.spec, [{ label: name, series: m.series, slot: 0 }], worldSeries(m.spec.slug), t)} />
      </Section>
      <CompareLinks place={place} m={m} t={t} />
      {others.length > 1 && (
        <Section title={t('{place} in numbers', { place: name })}>
          <p className="mb-5">
            <Link href={localePath(t.locale, placePath(place, HUB_SLUG))} className={TEXT_LINK}>{t('Every measure for {place} on one page', { place: name })}</Link>
          </p>
          <MeasureGroups place={place} measures={others} t={t} spark={false} skip={m.spec.slug} />
        </Section>
      )}
    </>
  );
}

function HubHero({ place, measures, t }: { place: Place; measures: TopicPage<IndicatorMeasure>[]; t: Translate }) {
  const shown = [...HEADLINE.flatMap(slug => measures.filter(m => m.slug === slug)), ...measures.filter(m => !HEADLINE.includes(m.slug))].slice(0, 4);
  return (
    <ul className="grid grid-cols-2 gap-3">
      {shown.map(m => <li key={m.slug}><MeasureCard place={place} m={m} t={t} big /></li>)}
    </ul>
  );
}

function HubCompare({ place, t }: { place: Place; t: Translate }) {
  const partners = comparedWith(place);
  if (!partners.length) return null;
  const name = nameOf(place, t);
  return (
    <Section title={t('Compare {place} with…', { place: name })}>
      <ul className="grid gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
        {partners.map(p => (
          <li key={p.id} className="text-[14px]">
            <Link href={localePath(t.locale, comparePath({ a: place, b: p }))} className={TEXT_LINK}>{t('{a} vs {b}', { a: name, b: nameOf(p, t) })}</Link>
          </li>
        ))}
      </ul>
    </Section>
  );
}

function hubNotes(measures: TopicPage<IndicatorMeasure>[], t: Translate): string[] {
  const by = [...new Set(measures.map(m => m.data.spec.by))];
  const modelled = measures.filter(m => basisOf(m.data.spec) === 'modelled').length;
  return [
    t('Sources: {list}. Each measure’s page names its own and what it counts.', { list: listOf(by, t) }),
    t('Values are drawn on today’s borders. Years without a published value are left empty, never filled in.'),
    ...(modelled ? [t('{n, plural, one {One measure is} other {# measures are}} climate model output, marked as modelled: not measurements.', { n: modelled })] : []),
  ];
}

export const INDICATORS_VIEW: TopicView<IndicatorData> = {
  icon: ChartIcon,

  Hero({ text: { t }, place, page: { data } }) {
    return data.kind === 'hub' ? <HubHero place={place} measures={data.measures} t={t} /> : <MeasureChart place={place} m={data} t={t} />;
  },

  Body({ text, place, page: { data } }) {
    const { t } = text;
    if (data.kind === 'measure') {
      return (
        <>
          <MeasureBody place={place} m={data} t={t} />
          <Notes text={text} notes={indicatorNotes(data.spec, [data.series], data.meta, t)} layers={['country-data-over-time']} />
        </>
      );
    }
    return (
      <>
        <Section title={t('Every measure')}>
          <MeasureGroups place={place} measures={data.measures} t={t} />
        </Section>
        <HubCompare place={place} t={t} />
        <Notes text={text} notes={hubNotes(data.measures, t)} layers={['country-data-over-time']} />
      </>
    );
  },
};

