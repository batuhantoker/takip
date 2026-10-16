import { describe, expect, it } from 'vitest';
import { cwfisUrl, parseBcFires, parseCwfis } from './cwfis';

// Shaped from the CWFIS and BC OpenMaps WFS layers, 2026-10-12.
const ON = {
  properties: {
    agency_code: 'ON', agency_fire_id: 'WAW_FIRE_035', national_fire_id: '2026_ON_WAW_FIRE_035', national_fire_cause: 'H',
    fire_size: 6.5, stage_of_control_status: 'OC', status_date: '2026-10-12T18:36:00Z', latitude: 47.2527, longitude: -84.5886,
  },
  geometry: { type: 'Point', coordinates: [790194.6753, -130152.1738] },
};
const BC = {
  properties: {
    agency_code: 'BC', agency_fire_id: '2026-C10467', national_fire_id: '2026_BC_2026-C10467', national_fire_cause: 'N',
    fire_size: 1815, stage_of_control_status: 'UC', status_date: '2026-10-01T08:00:00Z', latitude: 53.9, longitude: -124.6,
  },
};
const BC_FEED = {
  features: [
    { properties: { FIRE_NUMBER: 'C10467', FIRE_STATUS: 'Under Control', INCIDENT_NAME: 'Swede Creek', GEOGRAPHIC_DESCRIPTION: '3.8km SW of Comstock Lake', FIRE_URL: 'https://wildfiresituation.nrs.gov.bc.ca/incidents?fireYear=2026&incidentNumber=C10467', FIRE_OF_NOTE_IND: 'Y' } },
    { properties: { FIRE_NUMBER: 'N41279', INCIDENT_NAME: 'N41279', GEOGRAPHIC_DESCRIPTION: 'Nightmare FSR', FIRE_OF_NOTE_IND: 'N' } },
  ],
};

describe('cwfisUrl', () => {
  it('asks only for fire versions current at that instant, excluding prescribed burns', () => {
    const url = decodeURIComponent(cwfisUrl(new Date('2026-10-12T20:20:00.123Z')));
    expect(url).toContain("record_start <= '2026-10-12T20:20:00Z' AND record_end > '2026-10-12T20:20:00Z' AND fire_was_prescribed <> 1");
  });
});

describe('parseBcFires', () => {
  it('names a fire by its incident name, falling back to the place when the name is just the number', () => {
    const bc = parseBcFires(BC_FEED);
    expect(bc.get('C10467')).toEqual({ name: 'Swede Creek', url: 'https://wildfiresituation.nrs.gov.bc.ca/incidents?fireYear=2026&incidentNumber=C10467', ofNote: true });
    expect(bc.get('N41279')?.name).toBe('Nightmare FSR');
  });
});

describe('parseCwfis', () => {
  it('maps a fire from its lat/lon properties, not the EPSG:3978 geometry', () => {
    expect(parseCwfis({ features: [ON] })).toEqual([{
      id: '2026_ON_WAW_FIRE_035',
      name: 'WAW_FIRE_035',
      agency: 'Ontario',
      lat: 47.2527,
      lng: -84.5886,
      sizeHa: 6.5,
      stage: 'OC',
      stageLabel: 'Out of control',
      cause: 'Human',
      updated: '2026-10-12T18:36:00Z',
      ofNote: undefined,
      url: 'https://cwfis.cfs.nrcan.gc.ca/interactive-map',
      provider: 'CWFIS',
    }]);
  });

  it('joins BC fires to the province feed by fire number', () => {
    const [f] = parseCwfis({ features: [BC] }, parseBcFires(BC_FEED));
    expect(f).toMatchObject({ name: 'Swede Creek', ofNote: true, stageLabel: 'Under control', url: expect.stringContaining('C10467') });
  });

  it('drops extinguished or unplaced rows and rejects a non-WFS body', () => {
    expect(parseCwfis({ features: [{ properties: { ...ON.properties, stage_of_control_status: 'EX' } }, { properties: { ...ON.properties, latitude: null } }] })).toEqual([]);
    expect(() => parseCwfis('<ows:ExceptionReport/>')).toThrow(/WFS shape/);
  });
});
