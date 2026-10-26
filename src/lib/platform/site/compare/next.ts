import { pairMeasures, type PairMeasure } from './compare';
import { HIGHLIGHTS, pairIndexed, pairMeasureIndexed } from './compare-copy';
import { comparedWith, type CountryPair } from './pairs';

/**
 * Where a comparison leads next: the same two on the measures people look at most, and the pairs that share a
 * country with it. Only pages put forward for search are offered, so the links add no addresses for crawlers.
 */

const NEXT_PAIRS = 6;
const NEXT_MEASURES = 4;

/**
 * Listed pairs that share a country with this one, each country's partners in turn, most populous first, the shared
 * country named first. With a measure, only pairs whose page for it is indexed; without, pairs whose overview is.
 */
export function nextPairs(pair: CountryPair, measure?: string, limit = NEXT_PAIRS): CountryPair[] {
  const skip = new Set([pair.a.id, pair.b.id]);
  const [fromA, fromB] = [pair.a, pair.b].map(c => comparedWith(c).filter(p => !skip.has(p.id)).map(p => ({ a: c, b: p })));
  const out: CountryPair[] = [];
  for (let i = 0; out.length < limit && (i < fromA.length || i < fromB.length); i++) {
    for (const next of [fromA[i], fromB[i]]) {
      if (!next || out.length >= limit) continue;
      const measures = pairMeasures(next);
      if (measure ? measures.some(m => m.spec.slug === measure && pairMeasureIndexed(next, m)) : pairIndexed(next, measures)) out.push(next);
    }
  }
  return out;
}

/** The pair's other measures worth a click, the overview's highlights first, then the rest in the table's order. */
export function nextMeasures(measures: PairMeasure[], current: string, limit = NEXT_MEASURES): PairMeasure[] {
  const rank = (m: PairMeasure) => (HIGHLIGHTS.includes(m.spec.slug) ? HIGHLIGHTS.indexOf(m.spec.slug) : HIGHLIGHTS.length);
  return measures.filter(m => m.spec.slug !== current).map((m, i) => ({ m, i })).sort((x, y) => rank(x.m) - rank(y.m) || x.i - y.i).slice(0, limit).map(x => x.m);
}
