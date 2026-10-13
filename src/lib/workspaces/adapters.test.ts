import { describe, expect, it } from 'vitest';
import { deserializeShapes } from '@/lib/areas/aoi-export';
import { areasFrom, layersOver, oneOf, storedAreas } from './adapters';

const AREA = {
  id: 'a1', name: 'Area 1', kind: 'polygon', areaKm2: 12, perimeterKm: 14, color: '#00E5FF', createdAt: 1,
  geojson: { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [[[29, 41], [30, 41], [30, 42], [29, 41]]] } },
};

describe('adapters', () => {
  it('turn drawn areas into stored ones and back', () => {
    const shapes = deserializeShapes(JSON.stringify([AREA]));
    expect(storedAreas(shapes)).toEqual([AREA]);
    expect(areasFrom(storedAreas(shapes))).toEqual(shapes);
    expect(areasFrom([{ id: 'x', name: 'no geometry' } as never])).toEqual([]);
  });

  it('lay saved layers over the current ones, ignoring unknown ids', () => {
    expect(layersOver({ flights: false, maritime: true }, { flights: true, gone: true })).toEqual({ flights: true, maritime: true });
  });

  it('accept only allowed values', () => {
    expect(oneOf('topo', ['dark', 'topo'] as const, 'dark')).toBe('topo');
    expect(oneOf('neon', ['dark', 'topo'] as const, 'dark')).toBe('dark');
    expect(oneOf(null, ['layers'] as const, null)).toBeNull();
  });
});
