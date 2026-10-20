import type { Translate } from '@/lib/core/i18n/translator';
import { indicatorSpec } from '../places/topics/indicators-data';
import { pairMeasures } from './compare';
import { pairMeasureCopy, pairOverviewCopy } from './compare-copy';
import { parsePairSlug } from './pairs';
import { worldCopy, worldMeasure } from './world';

/**
 * A comparison's or a world page's share card, for /og?place=compare/<a>-vs-<b>[/<measure>] or world/<measure>,
 * drawn like a place page's (places/card.ts); null for anything that isn't a page.
 */
export function compareCard(key: string, t: Translate): { kicker: string; title: string; subtitle: string; points: { lat: number; lon: number }[]; picture: string } | null {
  const [kind, slug, measure, ...rest] = key.split('/');
  if (rest.length) return null;
  const first = (lede: string) => lede.split(/(?<=[.!?])\s+|(?<=[。！？])/)[0];
  if (kind === 'world' && !measure) {
    const w = worldMeasure(slug);
    if (!w) return null;
    const copy = worldCopy(w, t);
    return { kicker: t('Around the world'), title: copy.heading, subtitle: first(copy.lede), points: [], picture: `world-${slug}` };
  }
  if (kind !== 'compare') return null;
  const parsed = parsePairSlug(slug);
  if (!parsed?.canonical || (measure && !indicatorSpec(measure))) return null;
  const measures = pairMeasures(parsed.pair);
  const m = measure ? measures.find(x => x.spec.slug === measure) : undefined;
  if (measure ? !m : !measures.length) return null;
  const copy = m ? pairMeasureCopy(parsed.pair, m, t) : pairOverviewCopy(parsed.pair, measures, t);
  const { a, b } = parsed.pair;
  return {
    kicker: t('Compare'), title: copy.heading, subtitle: first(copy.lede),
    points: [{ lat: a.at[1], lon: a.at[0] }, { lat: b.at[1], lon: b.at[0] }], picture: `compare-${slug}${measure ? `-${measure}` : ''}`,
  };
}
