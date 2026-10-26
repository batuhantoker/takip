import { describe, expect, it } from 'vitest';
import { LAYER_GROUPS } from '@/components/panels/layers/layer-groups';
import { LAYER_PAGES } from '@/lib/platform/site/layer-pages';
import { BASE_LAYERS } from '@/lib/platform/site/map-link';

/** Layers with no public page of their own, and why. A new layer gets a page in lib/platform/site/catalog or a line here. */
const NO_PAGE: Record<string, string> = {
  sat_earth: 'covered by the satellite tracker',
  infrastructure: 'a hand-picked list of 64 sites, too incomplete to offer as a map of nuclear plants',
  terrain_3d: 'a display option',
  terrain_elevation: 'a display option',
  things_to_do: 'each city and country has its own things-to-do page',
};

describe('public layer pages', () => {
  it('cover every layer in the Layers panel', () => {
    const covered = new Set<string>([...BASE_LAYERS, ...LAYER_PAGES.flatMap(p => p.layers)]);
    const missing = LAYER_GROUPS.flatMap(g => g.layers)
      .filter(l => !l.parent && !l.key.startsWith('ref_') && !covered.has(l.key) && !(l.key in NO_PAGE))
      .map(l => l.key);
    expect(missing).toEqual([]);
  });

  it('list no layer as page-less that has a page', () => {
    const paged = new Set(LAYER_PAGES.flatMap(p => p.layers));
    expect(Object.keys(NO_PAGE).filter(k => paged.has(k))).toEqual([]);
  });
});
