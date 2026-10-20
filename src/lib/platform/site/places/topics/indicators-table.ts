import { topicTable } from '../tables';
import { indicatorSpec, type IndicatorMeta, type IndicatorRow, type IndicatorSeries, type IndicatorSpec } from './indicators-data';

/**
 * Reading data/site/topics/indicators.json: a country's series for a measure, by GeoNames id or ISO 3166-1 alpha-2,
 * and the World's. Shared by the country pages and anything else that charts the same numbers, so none of them
 * opens history.db.
 */

export const indicatorTable = () => topicTable<IndicatorRow, IndicatorMeta>('indicators');

const byCc = new WeakMap<object, Map<string, string>>();

/** The row for a GeoNames id (a number) or an ISO2 code (a string). */
export function indicatorRow(key: number | string): IndicatorRow | undefined {
  const { rows } = indicatorTable();
  if (typeof key === 'number') return rows[String(key)];
  let index = byCc.get(rows);
  if (!index) byCc.set(rows, (index = new Map(Object.entries(rows).map(([id, r]) => [r.cc, id]))));
  const id = index.get(key.toUpperCase());
  return id === undefined ? undefined : rows[id];
}

export interface CountrySeries { spec: IndicatorSpec; series: IndicatorSeries; row: IndicatorRow }

/** A country's series for one measure, or undefined where it has none. */
export function indicatorSeries(slug: string, key: number | string): CountrySeries | undefined {
  const spec = indicatorSpec(slug);
  const row = indicatorRow(key);
  const series = row?.m[slug];
  return spec && row && series ? { spec, series, row } : undefined;
}

export const worldSeries = (slug: string) => indicatorTable().meta?.metrics[slug]?.world;
