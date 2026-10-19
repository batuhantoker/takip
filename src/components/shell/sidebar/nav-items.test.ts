import { describe, expect, it } from 'vitest';
import { DEFAULT_DESKTOP } from '@/components/shell/layout/lib/model';
import { navItems, railGroups } from './nav-items';

const items = navItems({ layersOn: 0, arcgisCount: 0 });
const ids = (groups: { id: string }[][]) => groups.map(g => g.map(i => i.id));

describe('railGroups', () => {
  it('gives the designed sidebar for the default layout', () => {
    expect(ids(railGroups(items, DEFAULT_DESKTOP))).toEqual([
      ['layers', 'alerts', 'draw'],
      ['history', 'space', 'directions'],
      ['recon', 'arcgis'],
    ]);
  });

  it('follows the person’s order and gaps', () => {
    const rail = ['arcgis', 'layers', 'alerts', 'draw', 'history', 'space', 'directions', 'recon'] as const;
    expect(ids(railGroups(items, { ...DEFAULT_DESKTOP, rail: [...rail], railBreaks: ['draw'] }))).toEqual([
      ['arcgis', 'layers', 'alerts'],
      ['draw', 'history', 'space', 'directions', 'recon'],
    ]);
  });

  it('passes a hidden entry’s gap to the next one shown', () => {
    expect(ids(railGroups(items, { ...DEFAULT_DESKTOP, hidden: ['rail:history', 'rail:arcgis'] }))).toEqual([
      ['layers', 'alerts', 'draw'],
      ['space', 'directions'],
      ['recon'],
    ]);
  });

  it('starts no empty group when the first entries are hidden', () => {
    expect(ids(railGroups(items, { ...DEFAULT_DESKTOP, hidden: ['rail:layers', 'rail:alerts', 'rail:draw'] }))[0]).toEqual(['history', 'space', 'directions']);
  });
});
