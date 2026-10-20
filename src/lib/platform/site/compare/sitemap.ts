import { DATA_RECHECK_MS } from '../places/gazetteer';
import { indicatorTable } from '../places/topics/indicators-table';
import { comparePath, pairMeasures } from './compare';
import { pairIndexed, pairMeasureIndexed } from './compare-copy';
import { listedPairs } from './pairs';

let held: { rows: object; at: number; paths: string[] } | null = null;

/**
 * Every indexed comparison: each listed pair's overview and its measures that pass the bar (compare.ts,
 * compare-copy.ts). About a second to work out, and every sitemap chunk asks, so it is kept a while.
 */
export function compareSitemapPaths(): string[] {
  const { rows } = indicatorTable();
  if (held && held.rows === rows && Date.now() - held.at < DATA_RECHECK_MS) return held.paths;
  const paths = listedPairs().flatMap(pair => {
    const measures = pairMeasures(pair);
    return [...(pairIndexed(pair, measures) ? [comparePath(pair)] : []), ...measures.filter(m => pairMeasureIndexed(pair, m)).map(m => comparePath(pair, m.spec.slug))];
  });
  held = { rows, at: Date.now(), paths };
  return paths;
}
