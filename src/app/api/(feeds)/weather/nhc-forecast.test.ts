import { describe, expect, it } from 'vitest';
import { currentAdvisories, nhcLayerUrl, shapeForecast } from './nhc-forecast';

// Shaped from CurrentStorms.json and MapServer layers 5-7, 2026-10-16.
const STORMS = {
  activeStorms: [
    { id: 'ep212026', binNumber: 'EP1', name: 'Trudy', forecastAdvisory: { advNum: '011' } },
    { id: 'ep202026', binNumber: 'EP5', name: 'Simon', forecastAdvisory: { advNum: '035' } },
  ],
};
const square = { type: 'Polygon' as const, coordinates: [[[-110, 15], [-100, 15], [-100, 20], [-110, 15]]] };
const point = (props: Record<string, unknown>) => ({ type: 'Feature' as const, geometry: { type: 'Point' as const, coordinates: [-108, 20] }, properties: props });

describe('currentAdvisories', () => {
  it('reads each bin\'s advisory as a number', () => {
    expect([...currentAdvisories(STORMS)]).toEqual([['EP1', 11], ['EP5', 35]]);
    expect(currentAdvisories({}).size).toBe(0);
  });
});

describe('shapeForecast', () => {
  const advisories = currentAdvisories(STORMS);

  it('keeps only geometry from each storm\'s current advisory', () => {
    const cones = shapeForecast('cone', [
      { type: 'Feature', geometry: square, properties: { stormname: 'Trudy', binnumber: 'EP1', advisnum: '11', stormtype: 'HU' } },
      { type: 'Feature', geometry: square, properties: { stormname: 'Trudy', binnumber: 'EP1', advisnum: '10', stormtype: 'HU' } },
      { type: 'Feature', geometry: square, properties: { stormname: 'Old', binnumber: 'AL9', advisnum: '4' } },
    ], advisories);
    expect(cones).toHaveLength(1);
    expect(cones[0].properties).toEqual({ kind: 'cone', storm: 'Trudy', bin: 'EP1', advisory: 11, stormType: 'HU' });
  });

  it('reads a forecast point, dropping NHC\'s 9999 sentinel and the storm-type prefix', () => {
    const [p] = shapeForecast('point', [point({
      stormname: 'Tropical Storm Simon', binnumber: 'EP5', advisnum: '35', stormtype: 'TS', dvlbl: 'S', tau: 12,
      fldatelbl: '2026-10-16 5:00 AM Fri MST', datelbl: '5:00 AM Fri', maxwind: 35, gust: 45, mslp: 9999,
    })], advisories);
    expect(p.properties).toMatchObject({
      kind: 'point', storm: 'Simon', stage: 'S', stageLabel: 'Tropical storm', hours: 12, wind: 35, gust: 45, pressure: null, when: '2026-10-16 5:00 AM Fri MST',
    });
  });
});

describe('nhcLayerUrl', () => {
  it('asks the layer for GeoJSON', () => {
    expect(nhcLayerUrl(7)).toMatch(/MapServer\/7\/query\?.*f=geojson/);
  });
});
