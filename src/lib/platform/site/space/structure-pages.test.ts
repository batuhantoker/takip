import { describe, expect, it } from 'vitest';
import { parseViewModeLink } from '@/lib/map/view-mode-link';
import { spacePaths } from './sitemap';
import { SKY_PAGES } from './sky-pages';
import { STRUCTURE_PAGES, structureHref, structurePage } from './structure-pages';

describe('structure pages', () => {
  it('gives each structure a page of its own, none sharing an id with a picture', () => {
    const ids = STRUCTURE_PAGES.map(p => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.filter(id => SKY_PAGES.some(p => p.object.id === id))).toEqual([]);
    expect(structurePage('laniakea')?.group).toBe('basins');
    expect(structurePage('hercules-void')?.group).toBe('voids');
    expect(structurePage('cmb')?.group).toBe('edge');
  });

  it('covers Laniakea and its neighbours, the named structures, every nearest void and the edge', () => {
    const by = (g: string) => STRUCTURE_PAGES.filter(p => p.group === g).length;
    expect(by('basins')).toBe(6);
    expect(by('clusters')).toBe(13);
    expect(by('voids')).toBe(28);
    expect(by('edge')).toBe(1);
  });

  it('places each one, a basin by its attractor', () => {
    for (const p of STRUCTURE_PAGES) {
      expect(p.ly).toBeGreaterThan(1e7);
      if (p.id !== 'cmb') expect(p.feature.position).toBeDefined();
    }
    // Dupuy & Courtois' Laniakea attractor, 7,412 km/s out.
    expect(structurePage('laniakea')!.ly / 1e6).toBeCloseTo(355, -1);
  });

  it('opens the space view on the same feature', () => {
    for (const p of STRUCTURE_PAGES) {
      const link = parseViewModeLink(new URLSearchParams(structureHref(p).split('?')[1]));
      expect(link).toMatchObject({ view: 'space', focus: 'universe', select: { kind: 'feature', id: p.id } });
    }
  });

  it('lists every page once in the sitemap', () => {
    const paths = spacePaths();
    expect(new Set(paths).size).toBe(paths.length);
    expect(paths).toContain('/deep-sky/laniakea');
    expect(paths).toContain('/deep-sky/near-bootes-void');
  });
});

describe('dwarf planet and visitor pages', () => {
  it('opens each on its own body in the space view, and lists it once', async () => {
    const { OUTER_BODIES, planetPath } = await import('./planets');
    const { DWARF_PLANETS, VISITORS } = await import('@/lib/space/deep/outer');
    const { mapHref } = await import('../map-link');
    const paths = spacePaths();
    for (const o of OUTER_BODIES) {
      expect([...DWARF_PLANETS, ...VISITORS].some(b => b.key === o.key)).toBe(true);
      expect(paths.filter(p => p === planetPath(o))).toHaveLength(1);
      const href = mapHref({ layers: [], mode: { view: 'space', focus: 'solar', select: { kind: 'outer', key: o.key } } });
      expect(parseViewModeLink(new URLSearchParams(href.split('?')[1]))).toMatchObject({ select: { kind: 'outer', key: o.key } });
    }
  });
});
