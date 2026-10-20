// What tools/site/build-event-pages.ts decides, kept apart from the databases so it can be tested: which events
// are worth a search result, which of several events sharing a Wikipedia article owns it, and every page's slug.
import { baseSlug, keySuffix } from '../../../src/lib/platform/site/events/slug';

export interface EventRow {
  id: number;
  key: string;
  /** The event this one duplicates, or its own id. */
  canonical: number;
  kind: string;
  title: string | null;
  /** Epoch ms. */
  start: number;
  magnitude: number | null;
  wiki: string | null;
  /** False when `wiki` is the article of what the event mentions, not of the event: a year-page line's subject. */
  ownWiki?: boolean;
  /** False for a page whose text is in a language the site doesn't lead with (a year-page line from another Wikipedia). */
  indexable?: boolean;
  sourceId: number;
  /** Retracted by its source, or from a source the public may not see: no page. */
  gone: boolean;
}

export interface Planned {
  row: EventRow;
  slug: string;
  base: string;
  /** Distinct sources among the event and its duplicates; 0 for a duplicate. */
  sources: number;
  /** The article the page shows: the event's own, else a duplicate's. */
  wiki: string | null;
  indexed: boolean;
}

/** What the last build handed out, so no slug ever moves or is given to another event. */
export interface Ledger {
  byKey: Map<string, { slug: string; base: string }>;
  /** Every slug handed out, to the key it was given to. */
  slugs: Map<string, string>;
}

export const emptyLedger = (): Ledger => ({ byKey: new Map(), slugs: new Map() });

export const yearOf = (ms: number) => new Date(ms).getUTCFullYear();

/** More sources first, then the larger magnitude, then the later start, then the older record. */
function notability(a: { row: EventRow; sources: number }, b: { row: EventRow; sources: number }) {
  return b.sources - a.sources
    || (b.row.magnitude ?? -Infinity) - (a.row.magnitude ?? -Infinity)
    || b.row.start - a.row.start
    || a.row.id - b.row.id;
}

/**
 * Every live event's page. An event is indexed when it has a Wikipedia article of its own or two sources; an
 * article several events carry (a volcano's, for each of its eruptions; a quake's, for the tsunami it raised) counts
 * for the most notable of them only, so search sees one page per article.
 */
export function planPages(rows: EventRow[], ledger: Ledger, label: (kind: string) => string): { pages: Planned[]; aliases: Map<string, string> } {
  const live = rows.filter(r => !r.gone);
  const members = new Map<number, EventRow[]>();
  for (const r of live) members.set(r.canonical, [...(members.get(r.canonical) ?? []), r]);

  const pages = live.map(row => {
    const group = row.canonical === row.id ? members.get(row.id) ?? [row] : [];
    const wiki = row.canonical === row.id ? row.wiki ?? group.find(m => m.wiki)?.wiki ?? null : row.wiki;
    return { row, slug: '', base: '', sources: new Set(group.map(m => m.sourceId)).size, wiki, indexed: false };
  });

  const byArticle = new Map<string, Planned[]>();
  for (const p of pages) if (p.wiki && p.row.canonical === p.row.id && p.row.ownWiki !== false) byArticle.set(p.wiki, [...(byArticle.get(p.wiki) ?? []), p]);
  const owners = new Set([...byArticle.values()].map(ps => ps.sort(notability)[0]));
  for (const p of pages) p.indexed = p.row.canonical === p.row.id && p.row.indexable !== false && (owners.has(p) || p.sources >= 2);

  const aliases = assignSlugs(pages, ledger, label);
  return { pages, aliases };
}

/**
 * A slug, once handed out, stays with its event while the event's title and year give the same base; when they
 * change the event gets a new one and the old one is kept as an alias that redirects. A new event gets the bare
 * base if nobody has ever held it (indexed events first, then canonical ones, then the older record), otherwise the
 * base and a suffix from its own key. Returns the aliases, old slug to key.
 */
function assignSlugs(pages: Planned[], ledger: Ledger, label: (kind: string) => string): Map<string, string> {
  const taken = new Set(ledger.slugs.keys());
  const aliases = new Map<string, string>();
  const fresh: Planned[] = [];
  for (const p of pages) {
    p.base = baseSlug(p.row.title, yearOf(p.row.start), label(p.row.kind));
    const held = ledger.byKey.get(p.row.key);
    if (held && held.base === p.base) p.slug = held.slug;
    else {
      if (held) aliases.set(held.slug, p.row.key);
      fresh.push(p);
    }
  }
  const best = (a: Planned, b: Planned) => Number(b.indexed) - Number(a.indexed)
    || Number(b.row.canonical === b.row.id) - Number(a.row.canonical === a.row.id) || a.row.id - b.row.id;
  for (const p of fresh.sort(best)) {
    let slug = p.base;
    for (let n = 6; taken.has(slug); n += 2) slug = `${p.base}-${keySuffix(p.row.key, n)}`;
    p.slug = slug;
    taken.add(slug);
  }
  return aliases;
}
