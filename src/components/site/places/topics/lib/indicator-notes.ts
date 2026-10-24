import type { Translate } from '@/lib/core/i18n/translator';
import type { IndicatorMetricMeta, IndicatorSeries, IndicatorSpec } from '@/lib/platform/site/places/topics/indicators-data';
import { projectionName } from '@/lib/platform/site/places/topics/indicators-facts';

/** A measure's caveats, for one country's page or several side by side: what it is, whose, and what its marks mean. */
export function indicatorNotes(spec: IndicatorSpec, series: IndicatorSeries[], meta: IndicatorMetricMeta | undefined, t: Translate): string[] {
  const any = (f: (s: IndicatorSeries) => unknown) => series.some(f);
  const ranked = series.find(s => s.f.rank)?.f.rank;
  return [
    t(spec.about),
    t('Source: {credit}.', { credit: spec.credit }),
    ...(spec.earlier && any(s => s.l) ? [t('Before {year}: {credit}.', { year: String(Math.min(...series.map(s => s.f.first[0]))), credit: spec.earlier.credit })] : []),
    ...(spec.projection && any(s => s.p) ? [any(s => s.lo) && spec.projection.range
      ? t('The dashed line is the {projection}, a scenario rather than a forecast; the band is its {range}.', { projection: projectionName(spec.projection, t), range: t(spec.projection.range) })
      : t('The dashed line is the {projection}, a scenario rather than a forecast.', { projection: projectionName(spec.projection, t) })] : []),
    ...(spec.modelled || spec.model ? [t('Climate model values are the median of the CMIP6 models, run on past emissions to 2014 and on SSP2-4.5, a middle-of-the-road path, after: they are not measurements.')] : []),
    ...(any(s => s.est || s.unc) ? [t('Marked points are {by}’s own: a dot where it gives the figure as its estimate, a ring where it calls the figure highly uncertain.', { by: spec.by })] : []),
    ...(ranked && meta?.rankYear !== undefined ? [t('Ranks count the {n} countries with a value in {year}, highest first.', { n: ranked[1], year: String(meta.rankYear) })] : []),
    ...(meta?.world && !spec.total ? [t('The faint line is the world as a whole, as the same source counts it.')] : []),
  ];
}
