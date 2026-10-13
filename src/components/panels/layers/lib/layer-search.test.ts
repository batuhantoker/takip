import { describe, expect, it } from 'vitest';
import type { LayerGroupDef } from '@/components/panels/layers/layer-groups';
import { filterLayerGroups } from './layer-search';

const icon = () => null;

const GROUPS: LayerGroupDef[] = [
  {
    label: 'MARITIME', fullLabel: 'MARITIME', icon,
    layers: [
      { key: 'maritime', label: 'Maritime / Naval', dataKey: 'maritime_ships,maritime_ports' },
      { key: 'ships_tanker', label: 'Tankers', dataKey: '', parent: 'maritime' },
      { key: 'ships_fishing', label: 'Fishing', dataKey: '', parent: 'maritime' },
    ],
  },
  {
    label: 'HAZARD', fullLabel: 'NATURAL HAZARDS', icon,
    layers: [
      { key: 'earthquakes', label: 'Earthquakes', dataKey: 'earthquakes' },
      { key: 'fires', label: 'Active Fires', description: 'NASA FIRMS hotspots', dataKey: 'fires' },
    ],
  },
  {
    label: 'DISPLAY', fullLabel: 'DISPLAY', icon,
    layers: [
      { key: 'terrain_3d', label: '3D Buildings', dataKey: '' },
      { key: 'terrain_elevation', label: '3D Terrain', dataKey: '' },
    ],
  },
];

const keys = (groups: LayerGroupDef[]) => groups.flatMap(g => g.layers.map(l => l.key));

describe('filterLayerGroups', () => {
  it('returns every group for a blank query', () => {
    expect(filterLayerGroups(GROUPS, '')).toBe(GROUPS);
    expect(filterLayerGroups(GROUPS, '   ')).toBe(GROUPS);
  });

  it('matches labels case-insensitively and drops empty groups', () => {
    const out = filterLayerGroups(GROUPS, 'FIRE');
    expect(out.map(g => g.label)).toEqual(['HAZARD']);
    expect(keys(out)).toEqual(['fires']);
  });

  it('matches descriptions and keys', () => {
    expect(keys(filterLayerGroups(GROUPS, 'firms'))).toEqual(['fires']);
    expect(keys(filterLayerGroups(GROUPS, 'elevation'))).toEqual(['terrain_elevation']);
  });

  it('keeps the whole group when its name matches', () => {
    expect(keys(filterLayerGroups(GROUPS, 'natural'))).toEqual(['earthquakes', 'fires']);
  });

  it('brings the parent along with a matched sub-layer', () => {
    expect(keys(filterLayerGroups(GROUPS, 'tanker'))).toEqual(['maritime', 'ships_tanker']);
  });

  it('does not pull in sub-layers when only the parent matches', () => {
    expect(keys(filterLayerGroups(GROUPS, 'naval'))).toEqual(['maritime']);
  });

  it('needs every word to match', () => {
    expect(keys(filterLayerGroups(GROUPS, 'nasa fire'))).toEqual(['fires']);
    expect(filterLayerGroups(GROUPS, 'nasa quake')).toEqual([]);
    expect(keys(filterLayerGroups(GROUPS, '3d'))).toEqual(['terrain_3d', 'terrain_elevation']);
  });

  it('returns nothing for a query that matches nothing', () => {
    expect(filterLayerGroups(GROUPS, 'zzz')).toEqual([]);
  });
});
