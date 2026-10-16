import { describe, expect, it } from 'vitest';
import { parsePerimeters, wfigsUrl } from './wfigs';

// Shaped from the WFIGS current perimeters layer, 2026-10-16.
const GOLD = {
  type: 'Feature' as const,
  geometry: { type: 'Polygon' as const, coordinates: [[[-105.5, 40], [-105.4, 40], [-105.4, 40.1], [-105.5, 40]]] },
  properties: {
    poly_IncidentName: 'GOLD MOUNTAIN', attr_IncidentName: 'Gold Mountain', poly_GISAcres: 1203.4, attr_IncidentSize: 1210,
    attr_PercentContained: 92, attr_FireDiscoveryDateTime: 1790000000000, poly_DateCurrent: 1792000000000, attr_POOState: 'US-CO',
    attr_POOCounty: 'Boulder', attr_IncidentTypeCategory: 'WF', attr_FireCause: 'Human', attr_UniqueFireIdentifier: '2026-COBOD-000123',
  },
};

describe('wfigsUrl', () => {
  it('asks for simplified GeoJSON one page at a time', () => {
    const q = new URL(wfigsUrl(2000)).searchParams;
    expect(q.get('f')).toBe('geojson');
    expect(q.get('maxAllowableOffset')).toBe('0.001');
    expect(q.get('resultOffset')).toBe('2000');
  });
});

describe('parsePerimeters', () => {
  it('names the incident and reads its size, containment and place', () => {
    const [f] = parsePerimeters([GOLD]);
    expect(f.geometry).toBe(GOLD.geometry);
    expect(f.properties).toEqual({
      id: '2026-COBOD-000123', name: 'Gold Mountain', acres: 1210, contained: 92, discovered: 1790000000000, mapped: 1792000000000,
      state: 'CO', county: 'Boulder', kind: 'wildfire', cause: 'Human',
    });
  });

  it('falls back to the perimeter name and area, marks prescribed burns and drops shapeless rows', () => {
    const rx = { ...GOLD, properties: { poly_IncidentName: 'NUBYS CORNER AREA', poly_GISAcres: 1.9, attr_IncidentTypeCategory: 'RX' } };
    const out = parsePerimeters([rx, { ...GOLD, geometry: null }]);
    expect(out).toHaveLength(1);
    expect(out[0].properties).toMatchObject({ name: 'Nubys Corner Area', acres: 1.9, contained: null, kind: 'prescribed', state: null });
  });
});
