// What tools/site/build-mountains.ts decides, kept apart from the fetching so it can be tested: which statement of a
// height counts, what kind of peak an item is, which pages search should see, and every page's slug.
import { LOCALES, type Locale } from '../../../src/lib/core/i18n/locales';
import { slugWords } from '../../../src/lib/platform/site/events/slug';
import type { ByLocale, MountainKind } from '../../../src/lib/platform/site/mountains/data';

const UNITS: Record<string, number> = {
  Q11573: 1, // metre
  Q3710: 0.3048, // foot
  Q828224: 1000, // kilometre
  Q253276: 1609.344, // mile
};

export interface Quantity { rank: string; amount: number; unit: string }

/**
 * One value from a property's statements, in metres: the preferred ones where any are, else the normal ones,
 * deprecated never; of several, the median, so one stray survey or a height typed in feet as metres doesn't win.
 */
export function pickMetres(statements: Quantity[]): number | null {
  const usable = statements.filter(s => UNITS[s.unit] !== undefined && Number.isFinite(s.amount) && !s.rank.endsWith('DeprecatedRank'));
  const preferred = usable.filter(s => s.rank.endsWith('PreferredRank'));
  const best = (preferred.length ? preferred : usable).map(s => s.amount * UNITS[s.unit]).sort((a, b) => a - b);
  return best.length ? best[(best.length - 1) >> 1] : null;
}

/** Volcano wins over hill and mountain, mountain over hill, by the roots each of an item's classes descends from. */
export function kindOf(roots: Set<string>): MountainKind {
  if (roots.has('volcano')) return 'volcano';
  if (roots.has('mountain') || roots.has('summit') || roots.has('massif')) return 'mountain';
  return 'hill';
}

/** "Mount Olympus (Washington)" → "Mount Olympus". */
export const unqualified = (title: string) => title.replace(/\s*\([^)]*\)\s*$/, '').replace(/,\s.*$/, '').trim() || title;

/**
 * A name per page language: Wikidata's label, else the article's title without its qualifier; English falls back
 * to the label every language shares ("mul").
 */
export function namesFor(labels: Map<string, string>, wiki: ByLocale): ByLocale {
  const names: ByLocale = {};
  for (const l of LOCALES) {
    const name = labels.get(l) ?? (wiki[l] ? unqualified(wiki[l]!) : undefined) ?? (l === 'en' ? labels.get('mul') : undefined);
    if (name) names[l] = name;
  }
  return names;
}

/**
 * Worth a search result: a known height and an English article, or articles in two of the page languages. Pages
 * below that render noindex, follow (docs/architecture/public-pages.md).
 */
export function isIndexed(elev: number | null, wiki: ByLocale): boolean {
  return elev !== null && (!!wiki.en || Object.keys(wiki).length >= 2);
}

export interface SlugInput {
  qid: string;
  names: ByLocale;
  wiki: ByLocale;
  /** The English names of its countries, to tell two Mount Washingtons apart. */
  countries: string[];
  kind: MountainKind;
  indexed: boolean;
  articles: number;
  elev: number | null;
}

/** The previous build's slugs: each mountain's, and every slug ever handed out with whom it went to. */
export interface Ledger { byQid: Map<string, string>; slugs: Map<string, string> }

export const emptyLedger = (): Ledger => ({ byQid: new Map(), slugs: new Map() });

/** The slug before collisions: the English name, else another Latin one, else the kind and the id. */
export function baseSlug(m: Pick<SlugInput, 'qid' | 'names' | 'kind'>): string {
  const latin: Locale[] = ['en', 'fr', 'de', 'es', 'pt', 'tr'];
  for (const l of latin) {
    const words = m.names[l] ? slugWords(m.names[l]!) : '';
    if (/[a-z]/.test(words)) return words;
  }
  return `${m.kind}-${m.qid.slice(1)}`;
}

/** Indexed pages first, then those with more Wikipedias, then the higher, then the older item. */
function notability(a: SlugInput, b: SlugInput) {
  return Number(b.indexed) - Number(a.indexed) || b.articles - a.articles || (b.elev ?? -1e9) - (a.elev ?? -1e9)
    || Number(a.qid.slice(1)) - Number(b.qid.slice(1));
}

/**
 * Every mountain's slug. One handed out stays with its mountain for good, even when its name changes, and is never
 * given to another. A new one takes its name if free, else the name its English article is titled by
 * ("mount-olympus-washington"), else the name and its country, else the name and its Wikidata number.
 */
export function assignSlugs(items: SlugInput[], ledger: Ledger): Map<string, string> {
  const out = new Map<string, string>();
  const taken = new Set(ledger.slugs.keys());
  const fresh: SlugInput[] = [];
  for (const m of items) {
    const held = ledger.byQid.get(m.qid);
    if (held) out.set(m.qid, held);
    else fresh.push(m);
  }
  for (const m of fresh.sort(notability)) {
    const base = baseSlug(m);
    const titled = m.wiki.en ? slugWords(m.wiki.en) : '';
    const tries = [base, titled, ...m.countries.map(c => `${base}-${slugWords(c)}`), `${base}-${m.qid.slice(1)}`];
    const slug = tries.find(s => /[a-z]/.test(s) && !taken.has(s))!;
    taken.add(slug);
    out.set(m.qid, slug);
  }
  return out;
}
