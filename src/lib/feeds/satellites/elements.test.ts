import { describe, expect, it } from 'vitest';
import { decodeElements, elementLines, encodeElements, isElementColumns, satelliteData } from './elements';

const ISS = {
  name: 'ISS (ZARYA)',
  line1: '1 25544U 98067A   24146.40251785  .00015505  00000-0  27885-3 0  9997',
  line2: '2 25544  51.6402 189.7042 0004381 334.8091 106.8778 15.50091157455243',
};
const STARLINK = {
  name: 'STARLINK-1007',
  line1: '1 44713U 19074A   24146.50000000  .00001000  00000-0  85000-4 0  9991',
  line2: '2 44713  53.0540 120.0000 0001500  90.0000 270.0000 15.06400000 12345',
};
const ODD = { name: 'SHORT LINES', line1: '1 99999U', line2: '2 88888' };

describe('satellite element sets', () => {
  it('rebuilds every line byte for byte, malformed ones included', () => {
    const wire = JSON.parse(JSON.stringify(encodeElements([ISS, STARLINK, ODD])));
    expect(isElementColumns(wire)).toBe(true);
    expect(elementLines(wire)).toEqual([ISS, STARLINK, ODD]);
  });

  it('sends a repeated catalogue number once', () => {
    const wire = encodeElements([ISS, ODD]);
    expect(wire.line2[1]).toEqual([null, '88888']);
  });

  it('places and labels each satellite as the JSON route does, leaving out sets SGP4 declines', () => {
    const when = new Date('2024-05-25T12:00:00Z');
    const { satellites, category_counts } = decodeElements(encodeElements([ISS, STARLINK, ODD]), when);
    expect(satellites.map(s => [s.name, s.noradId, s.category, s.mission])).toEqual([
      ['ISS (ZARYA)', '25544', 'science', 'Space Station'],
      ['STARLINK-1007', '44713', 'comms', 'Commercial Comms'],
    ]);
    expect(category_counts).toEqual({ science: 1, comms: 1 });
    expect(satellites[0].alt).toBeGreaterThan(350);
    expect(satellites[0].alt).toBeLessThan(450);
    expect(Math.abs(satellites[0].lat)).toBeLessThanOrEqual(51.7);
  });

  it('adds nothing to the page for an answer that is not element sets', () => {
    expect(satelliteData({ error: 'Failed' })).toEqual({});
    expect(satelliteData(encodeElements([ISS]), new Date('2024-05-25T12:00:00Z')).satellites_at).toBe('2024-05-25T12:00:00.000Z');
  });
});
