import { describe, expect, it } from 'vitest';
import { emptyLedger, type EventRow, type Ledger, planPages } from './plan';

const Y = (year: number) => Date.UTC(year, 0, 1);
const row = (id: number, over: Partial<EventRow> = {}): EventRow => ({
  id, key: `src:${id}`, canonical: id, kind: 'battle', title: 'Battle of X', start: Y(1915), magnitude: null, wiki: null, sourceId: 1, gone: false, ...over,
});
const label = (kind: string) => kind;
const plan = (rows: EventRow[], ledger: Ledger = emptyLedger()) => planPages(rows, ledger, label);
const bySlug = (rows: EventRow[], ledger?: Ledger) => Object.fromEntries(plan(rows, ledger).pages.map(p => [p.row.key, p.slug]));

/** The ledger a build leaves, as build-event-pages.ts reads it back. */
function ledgerOf(rows: EventRow[], before: Ledger = emptyLedger()): Ledger {
  const { pages, aliases } = plan(rows, before);
  const slugs = new Map(before.slugs);
  for (const p of pages) slugs.set(p.slug, p.row.key);
  for (const [slug, key] of aliases) slugs.set(slug, key);
  return { byKey: new Map(pages.map(p => [p.row.key, { slug: p.slug, base: p.base }])), slugs };
}

describe('planPages', () => {
  it('gives the bare slug to an indexed event over an older one', () => {
    const slugs = bySlug([row(1), row(2, { wiki: 'Battle of X' })]);
    expect(slugs['src:2']).toBe('battle-of-x-1915');
    expect(slugs['src:1']).toMatch(/^battle-of-x-1915-[0-9a-f]{6}$/);
  });

  it('gives the bare slug to the canonical event, then the older record, and suffixes the rest', () => {
    const slugs = bySlug([row(5), row(3, { canonical: 5, sourceId: 2 }), row(9)]);
    expect(slugs['src:5']).toBe('battle-of-x-1915');
    expect(slugs['src:3']).toMatch(/^battle-of-x-1915-[0-9a-f]{6}$/);
    expect(slugs['src:9']).toMatch(/^battle-of-x-1915-[0-9a-f]{6}$/);
  });

  it('keeps every slug when a later import adds an event with the same base, even an older record', () => {
    const first = [row(10), row(11, { title: 'Battle of Y' })];
    const ledger = ledgerOf(first);
    const slugs = bySlug([...first, row(2, { wiki: 'Battle of X' })], ledger);
    expect(slugs['src:10']).toBe('battle-of-x-1915');
    expect(slugs['src:11']).toBe('battle-of-y-1915');
    expect(slugs['src:2']).toMatch(/^battle-of-x-1915-[0-9a-f]{6}$/);
  });

  it('gives a renamed event a new slug and keeps the old one as an alias', () => {
    const ledger = ledgerOf([row(1)]);
    const { pages, aliases } = plan([row(1, { title: 'Battle of Z' })], ledger);
    expect(pages[0].slug).toBe('battle-of-z-1915');
    expect(aliases.get('battle-of-x-1915')).toBe('src:1');
  });

  it('never hands out a slug again, even after its event is gone', () => {
    const ledger = ledgerOf([row(1)]);
    expect(bySlug([row(1, { gone: true }), row(7)], ledger)['src:7']).toMatch(/^battle-of-x-1915-[0-9a-f]{6}$/);
  });

  it('indexes an event with its own article or two sources, and counts a shared article once', () => {
    const pages = plan([
      row(1, { wiki: 'Mount K', title: 'Eruption A', kind: 'hazard.volcano' }),
      row(2, { wiki: 'Mount K', title: 'Eruption B', kind: 'hazard.volcano', start: Y(1990) }),
      row(3, { title: 'Battle of Q' }),
      row(4, { title: 'Battle of Q', canonical: 3, sourceId: 2 }),
      row(5, { title: 'Battle of R' }),
    ]).pages;
    const indexed = Object.fromEntries(pages.map(p => [p.row.id, p.indexed]));
    // The later eruption owns the volcano's article; the battle with two sources indexes without one.
    expect(indexed).toEqual({ 1: false, 2: true, 3: true, 4: false, 5: false });
    expect(pages.find(p => p.row.id === 3)?.sources).toBe(2);
  });

  it('shows a duplicate’s article on its canonical event', () => {
    const pages = plan([row(1), row(2, { canonical: 1, sourceId: 2, wiki: 'fr:Bataille de X' })]).pages;
    expect(pages.find(p => p.row.id === 1)?.wiki).toBe('fr:Bataille de X');
  });

  it('does not index a line for the article of its subject', () => {
    const { pages } = planPages([row(1, { wiki: 'Isaac Newton', ownWiki: false }), row(2, { wiki: 'Battle of X' })], emptyLedger(), k => k);
    expect(pages.map(p => p.indexed)).toEqual([false, true]);
  });
});
