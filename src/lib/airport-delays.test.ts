import { describe, expect, it } from 'vitest';
import { airportDelayFeatures, airportDelayPopupHtml, type AirportDelayRow } from './airport-delays';

const RDU_STOP: AirportDelayRow = { id: 'faa-ground_stop-RDU', code: 'RDU', name: 'Raleigh-Durham', lat: 35.88, lng: -78.79, type: 'ground_stop', severity: 'severe', reason: 'thunderstorms', endTime: '5:00 pm EDT', source: 'https://nasstatus.faa.gov/' };
const RDU_GDP: AirportDelayRow = { ...RDU_STOP, id: 'faa-ground_delay-RDU', type: 'ground_delay', severity: 'major', avgDelayMin: 56, endTime: undefined };
const TEB: AirportDelayRow = { ...RDU_STOP, id: 'faa-departure_delay-TEB', code: 'TEB', type: 'departure_delay', severity: 'moderate', minDelayMin: 31, maxDelayMin: 45, lat: NaN };

describe('airportDelayFeatures', () => {
  it('pins each airport once at its worst row and drops unplaced ones', () => {
    const fs = airportDelayFeatures([RDU_GDP, RDU_STOP, TEB]);
    expect(fs).toHaveLength(1);
    expect(fs[0].properties).toMatchObject({ code: 'RDU', severity: 'severe', color: '#FF1744' });
    expect(JSON.parse(String(fs[0].properties?.rows))).toHaveLength(2);
  });
});

describe('airportDelayPopupHtml', () => {
  it('lists every programme, a range where the FAA gives no average, and escapes text', () => {
    const [f] = airportDelayFeatures([RDU_STOP, { ...RDU_GDP, type: 'arrival_delay', avgDelayMin: undefined, minDelayMin: 31, maxDelayMin: 45, reason: '<b>wx</b>' }]);
    const html = airportDelayPopupHtml(f.properties ?? {});
    expect(html).toContain('Ground stop');
    expect(html).toContain('until 5:00 pm EDT');
    expect(html).toContain('31–45 min');
    expect(html).not.toContain('<b>wx</b>');
  });
});
