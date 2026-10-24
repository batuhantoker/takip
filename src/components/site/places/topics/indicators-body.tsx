import { ArrowUpRight, ChartLine as ChartIcon } from 'lucide-react';
import Link from 'next/link';
import { Section, TEXT_LINK } from '@/components/site/pages/site-frame';
import { cx, FOCUS_RING } from '@/components/ui/class-names';
import type { Translate } from '@/lib/core/i18n/translator';
import { SERIES_INK } from '@/lib/map/style/tokens';
import { localePath } from '@/lib/platform/site/locale-path';
import { listOf, nameOf } from '@/lib/platform/site/places/copy/format';
import type { Place } from '@/lib/platform/site/places/place';
import { placePath } from '@/lib/platform/site/places/paths';
import type { TopicPage } from '@/lib/platform/site/places/topic';
import { HEADLINE, HUB_SLUG, INDICATOR_TOPIC, type IndicatorData, type IndicatorMeasure } from '@/lib/platform/site/places/topics/indicators';
import { basisOf, formatNumber, indicatorPoints, indicatorSentences, indicatorStats } from '@/lib/platform/site/places/topics/indicators-facts';
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
import { MeasureChartCard, measureTable } from './parts/measure-chart';
import { Points, StatTiles } from './parts/stat-tiles';

/** As many partners as a measure page links to. */
const MAX_PARTNERS = 8;
import type { TopicView } from './view';

function MeasureChart({ place, m, t }: { place: Place; m: IndicatorMeasure; t: Translate }) {
  const name = nameOf(place, t);
  return (
    <MeasureChartCard id={`chart-${m.spec.slug}`} spec={m.spec} places={[{ label: name, series: m.series, slot: 0 }]} world={m.spec.total ? undefined : worldSeries(m.spec.slug)} t={t}
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
    <section>
      <h2 className="text-[15px] font-semibold text-ink-1">{t('{metric} beside other countries', { metric })}</h2>
      {partners.length > 0 && (
        <ul className="mt-3 divide-y divide-line rounded-card border border-line bg-surface-1">
          {partners.map(p => (
            <li key={p.id}>
              <Link href={localePath(t.locale, comparePath({ a: place, b: p }, m.spec.slug))}
                className={cx('flex items-center justify-between gap-3 px-3 py-2 text-[14px] text-ink-2 hover:text-ink-1', FOCUS_RING)}>
                {t('{a} vs {b}', { a: nameOf(place, t), b: nameOf(p, t) })}
                <ArrowUpRight className="size-3.5 shrink-0 text-ink-3" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-4 text-[14px]">
        <Link href={localePath(t.locale, worldPath(m.spec.slug))} className={TEXT_LINK}>{t('{metric} around the world', { metric })}</Link>
      </p>
    </section>
  );
}

function MeasureBody({ place, m, t }: { place: Place; m: IndicatorMeasure; t: Translate }) {
  const name = nameOf(place, t);
  const points = indicatorPoints(m.spec, m.series, m.meta, name, t);
  return (
    <>
      {points.length > 0 && (
        <Section title={t('What the numbers say')}>
          <Points points={points} />
        </Section>
      )}
      <LongRun place={place} m={m} t={t} />
      <Section title={t('Every year')}>
        <IndicatorTable year={t('Year')} words={chartWords(t)} {...measureTable(m.spec, [{ label: name, series: m.series, slot: 0 }], worldSeries(m.spec.slug), t)} />
      </Section>
    </>
  );
}

/** The place's other measures, across the page. */
function OtherMeasures({ place, m, t }: { place: Place; m: IndicatorMeasure; t: Translate }) {
  const name = nameOf(place, t);
  const hub = INDICATOR_TOPIC.pages(place).find(p => p.slug === HUB_SLUG)?.data;
  const others = hub?.kind === 'hub' ? hub.measures : [];
  if (others.length < 2) return null;
  return (
    <Section title={t('{place} in numbers', { place: name })}>
      <p className="mb-5">
        <Link href={localePath(t.locale, placePath(place, HUB_SLUG))} className={TEXT_LINK}>{t('Every measure for {place} on one page', { place: name })}</Link>
      </p>
      <MeasureGroups place={place} measures={others} t={t} skip={m.spec.slug} wide />
    </Section>
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

/** What a country's overview shows of its numbers, in this order, filled up from the rest. */
const OVERVIEW = ['life-expectancy', 'population', 'gdp-per-person', 'military-spending', 'co2-per-person', 'democracy', 'internet-users', 'temperature'];

function OverviewNumbers({ place, measures, t }: { place: Place; measures: TopicPage<IndicatorMeasure>[]; t: Translate }) {
  const shown = [...OVERVIEW.flatMap(slug => measures.filter(m => m.slug === slug)), ...measures.filter(m => !OVERVIEW.includes(m.slug))].slice(0, OVERVIEW.length);
  const name = nameOf(place, t);
  return (
    <Section title={t('{place} in numbers', { place: name })}>
      <ul className="grid gap-3 sm:grid-cols-2">
        {shown.map(m => <li key={m.slug}><MeasureCard place={place} m={m} t={t} /></li>)}
      </ul>
      <p className="mt-4 text-[14px]">
        <Link href={localePath(t.locale, placePath(place, HUB_SLUG))} className={TEXT_LINK}>{t('Every measure for {place} on one page', { place: name })}</Link>
      </p>
    </Section>
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

  Lead({ text: { t }, page: { data } }) {
    return data.kind === 'measure' ? <StatTiles stats={indicatorStats(data.spec, data.series, data.meta, t)} /> : null;
  },

  Aside({ text: { t }, place, page: { data } }) {
    return data.kind === 'measure' ? <CompareLinks place={place} m={data} t={t} /> : null;
  },

  Footer({ text: { t }, place, page: { data } }) {
    return data.kind === 'measure' ? <OtherMeasures place={place} m={data} t={t} /> : null;
  },

  Wide({ text: { t }, place, page: { data } }) {
    return data.kind === 'hub' ? (
      <Section title={t('Every measure')}>
        <MeasureGroups place={place} measures={data.measures} t={t} wide />
      </Section>
    ) : null;
  },

  Overview({ text: { t }, place, page: { data } }) {
    return data.kind === 'hub' ? <OverviewNumbers place={place} measures={data.measures} t={t} /> : null;
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
        <HubCompare place={place} t={t} />
        <Notes text={text} notes={hubNotes(data.measures, t)} layers={['country-data-over-time']} />
      </>
    );
  },
};

