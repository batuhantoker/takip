import { describe, expect, it } from 'vitest';
import { decodePins, encodePins, isPinColumns } from './pins';

describe('camera pins', () => {
  const cameras = [
    { id: 'b-2', lat: 51.50067, lng: -0.01594, source: 'TfL', name: 'A406', feed_url: 'https://x/2.jpg' },
    { id: 'a-1', lat: -33.86882, lng: 151.20929, source: 'Live Traffic NSW', offline: true },
    { id: 'b-1', lat: 51.5421, lng: 0.00524, source: 'TfL' },
    { id: 'bad', lat: Number.NaN, lng: 1, source: 'TfL' },
    { id: 'c,1', lat: 35.6895, lng: 139.69171, source: 'MLIT' },
  ];

  it('round-trips id, position, source and off air to a metre', () => {
    const pins = decodePins(encodePins(cameras));
    const byId = new Map(pins.map(p => [p.id, p]));
    expect(pins).toHaveLength(4);
    expect(byId.get('a-1')).toEqual({ id: 'a-1', lat: -33.86882, lng: 151.20929, source: 'Live Traffic NSW', offline: true });
    expect(byId.get('b-2')).toEqual({ id: 'b-2', lat: 51.50067, lng: -0.01594, source: 'TfL' });
    expect(byId.get('c,1')?.lng).toBeCloseTo(139.69171, 5);
  });

  it('carries nothing but the pin', () => {
    const wire = JSON.stringify(encodePins(cameras));
    expect(wire).not.toContain('A406');
    expect(wire).not.toContain('https://');
  });

  it('stores each id as what differs from the one before', () => {
    const wire = encodePins([{ id: 'fdot-1909', lat: 1, lng: 1, source: 'FDOT' }, { id: 'fdot-1910', lat: 1, lng: 1, source: 'FDOT' }, { id: 'fdot-19', lat: 1, lng: 1, source: 'FDOT' }]);
    expect(wire.ids).toEqual(['fdot-19', '09', '10']);
    expect(wire.shared).toEqual([0, 7, 7]);
    expect(decodePins(wire).map(p => p.id)).toEqual(['fdot-19', 'fdot-1909', 'fdot-1910']);
  });

  it('survives JSON and rejects anything else', () => {
    const wire = JSON.parse(JSON.stringify(encodePins(cameras)));
    expect(isPinColumns(wire)).toBe(true);
    expect(isPinColumns({ cameras: [] })).toBe(false);
    expect(isPinColumns({ ...wire, lat: wire.lat.slice(1) })).toBe(false);
  });
});
