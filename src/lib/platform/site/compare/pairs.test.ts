import { describe, expect, it } from 'vitest';
import { placeBySlug } from '../places/gazetteer';
import { comparedWith, listedPairs, pairReasons, pairSlug, parsePairSlug } from './pairs';

const turkey = placeBySlug('country', 'turkey')!;
const greece = placeBySlug('country', 'greece')!;

describe('pair URLs', () => {
  it('names each pair once, alphabetically', () => {
    expect(pairSlug(turkey, greece)).toBe('greece-vs-turkey');
    expect(pairSlug(greece, turkey)).toBe('greece-vs-turkey');
  });

  it('reads both orders and says which is the address', () => {
    expect(parsePairSlug('greece-vs-turkey')).toMatchObject({ canonical: true, pair: { a: { slug: 'greece' }, b: { slug: 'turkey' } } });
    expect(parsePairSlug('turkey-vs-greece')).toMatchObject({ canonical: false });
  });

  it('refuses what names no two countries', () => {
    for (const s of ['turkey', 'turkey-vs-turkey', 'turkey-vs-atlantis', '-vs-greece', 'a-vs-b-vs-c', 'istanbul-vs-greece']) expect(parsePairSlug(s)).toBeNull();
  });
});

describe('listed pairs', () => {
  it('lists neighbours, with why', () => {
    expect(pairReasons(turkey, greece)).toContain('border');
    expect(comparedWith(turkey).map(p => p.slug)).toContain('greece');
  });

  it('compares a country with its neighbours before far-off big countries', () => {
    const france = placeBySlug('country', 'france');
    if (!france || !comparedWith(france).length) return;
    const first = comparedWith(france).slice(0, 4).map(p => p.slug);
    expect(first).toContain('germany');
    expect(first).not.toContain('india');
    expect(first).not.toContain('china');
  });

  it('gives every listed pair in its URL order', () => {
    const all = listedPairs();
    expect(all.length).toBeGreaterThan(300);
    expect(all.every(({ a, b }) => a.slug < b.slug)).toBe(true);
  });
});
