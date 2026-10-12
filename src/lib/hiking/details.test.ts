import { describe, expect, it } from 'vitest';
import { slimDetails } from './details';

// Trimmed from /details/relation/37360; the real `route` carries every way's geometry.
const E1_SWITZERLAND = {
  type: 'relation', id: 37360, ref: 'E1', name: 'European Long distance path E1 - part Switzerland', group: 'INT',
  linear: 'no', symbol_id: 'osmc_INT_black_00d7_white', operator: 'European Ramblers Association',
  note: 'only sparsely marked', description: 'European Long distance path E1 - part Switzerland',
  url: 'http://www.era-ewv-ferp.com/', wikipedia: { de: 'Europäischer Fernwanderweg E1', en: 'E1 European long distance path' },
  bbox: [952697.0153233331, 5765000.264865769, 1020769.4962006193, 6049895.628663723],
  superroutes: { 371743: { type: 'relation', id: 371743, ref: 'E1', name: 'European long distance path E1', group: 'INT' } },
  tags: { network: 'iwn', route: 'hiking' },
  route: { route_type: 'route', length: 311412, main: [{ ways: [{ geometry: { type: 'LineString', coordinates: [[0, 0], [1, 1]] } }] }] },
};

describe('slimDetails', () => {
  it('keeps what the popup shows and drops the geometry', () => {
    const d = slimDetails(E1_SWITZERLAND)!;
    expect(d).toMatchObject({ id: 37360, ref: 'E1', group: 'INT', length: 311412, operator: 'European Ramblers Association', subroutes: 0 });
    expect(d.superroutes).toEqual([{ id: 371743, name: 'European long distance path E1', ref: 'E1', group: 'INT' }]);
    expect(d.wikipedia).toBe('https://en.wikipedia.org/wiki/E1_European_long_distance_path');
    expect(JSON.stringify(d)).not.toContain('coordinates');
  });

  it('turns the bbox into west, south, east, north degrees', () => {
    const [w, s, e, n] = slimDetails(E1_SWITZERLAND)!.bbox!;
    expect(w).toBeCloseTo(8.558, 2);
    expect(e).toBeCloseTo(9.17, 2);
    expect(s).toBeCloseTo(45.904, 2);
    expect(n).toBeCloseTo(47.656, 2);
  });

  it('counts stages and tolerates a sparse route', () => {
    const d = slimDetails({ id: 1544944, group: 'NAT', subroutes: { 1: { id: 1 }, 2: { id: 2 } } })!;
    expect(d.subroutes).toBe(2);
    expect(d.bbox).toBeUndefined();
    expect(d.length).toBeUndefined();
    expect(slimDetails({ name: 'no id' })).toBeNull();
  });
});
