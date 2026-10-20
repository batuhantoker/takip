import Link from 'next/link';
import { cx, FOCUS_RING, TRANSITION } from '@/components/ui/class-names';
import type { Translate } from '@/lib/core/i18n/translator';
import { SERIES_INK } from '@/lib/map/style/tokens';
import { localePath } from '@/lib/platform/site/locale-path';
import type { Place } from '@/lib/platform/site/places/place';
import { placePath } from '@/lib/platform/site/places/paths';
import type { IndicatorMeasure } from '@/lib/platform/site/places/topics/indicators';
import { INDICATOR_GROUPS } from '@/lib/platform/site/places/topics/indicators-data';
import { basisOf, formatValue } from '@/lib/platform/site/places/topics/indicators-facts';
import type { TopicPage } from '@/lib/platform/site/places/topic';
import { Sparkline } from './indicator-chart';

type Measure = TopicPage<IndicatorMeasure>;

/** "77.2 years in 2023", "6.3 days in 2014, modelled". */
export function latestLine(m: IndicatorMeasure, t: Translate): string {
  const [year, v] = m.series.f.last;
  return basisOf(m.spec) === 'modelled'
    ? t('{v} in {year}, modelled', { v: formatValue(m.spec, v, t), year: String(year) })
    : t('{v} in {year}', { v: formatValue(m.spec, v, t), year: String(year) });
}

/** One measure as a card: its name, its latest value and, on the hub, its shape over the years. */
export function MeasureCard({ place, m, t, spark = true, big = false }: { place: Place; m: Measure; t: Translate; spark?: boolean; big?: boolean }) {
  const s = m.data.series;
  return (
    <Link href={localePath(t.locale, placePath(place, m.slug))}
      className={cx('flex h-full flex-col gap-1 rounded-card border border-line bg-surface-1 p-3 hover:border-line-strong', FOCUS_RING, TRANSITION)}>
      <span className="text-[14px] font-medium text-ink-1">{t(m.data.spec.label)}</span>
      <span className="text-[12px] text-ink-3">{latestLine(m.data, t)}</span>
      {spark && <Sparkline e={s.e} p={s.p} ink={SERIES_INK[0]} className={cx('mt-auto w-full pt-1.5', big ? 'h-16' : 'h-12')} />}
    </Link>
  );
}

/** Every measure the place has, under its group's name, in the table's order. */
export function MeasureGroups({ place, measures, t, spark = true, skip, wide = false }: { place: Place; measures: Measure[]; t: Translate; spark?: boolean; skip?: string; wide?: boolean }) {
  return (
    <div className="flex flex-col gap-8">
      {INDICATOR_GROUPS.map(g => {
        const inGroup = measures.filter(m => m.data.spec.group === g.id && m.slug !== skip);
        if (!inGroup.length) return null;
        return (
          <section key={g.id}>
            <h3 className="text-[15px] font-semibold text-ink-1">{t(g.label)}</h3>
            <ul className={cx('mt-3 grid gap-3', spark ? 'sm:grid-cols-2 lg:grid-cols-3' : 'sm:grid-cols-2', spark && wide && 'xl:grid-cols-4')}>
              {inGroup.map(m => <li key={m.slug}><MeasureCard place={place} m={m} t={t} spark={spark} /></li>)}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
