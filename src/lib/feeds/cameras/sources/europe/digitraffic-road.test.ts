import { describe, expect, it } from 'vitest';
import { digitrafficRoad, parseWeatherData, parseWeatherStations } from './digitraffic-road';

// Verbatim shapes from tie.digitraffic.fi weather/v1, 2026-10-12. C01503 (Inkoo) is paired with station 1013.
const STATIONS = parseWeatherStations({ features: [
  { type: 'Feature', id: 1013, geometry: { type: 'Point', coordinates: [23.99, 60.05, 0] }, properties: { id: 1013, name: 'kt51_Inkoo', collectionStatus: 'GATHERING', state: null } },
] });
const sensors = (keli: string) => [
  { id: 1, stationId: 1013, name: 'ILMA', measuredTime: '2026-10-12T20:51:46Z', unit: '°C', value: 5.8 },
  { id: 3, stationId: 1013, name: 'TIE_1', measuredTime: '2026-10-12T20:51:46Z', unit: '°C', value: 6.4 },
  { id: 27, stationId: 1013, name: 'KELI_1', measuredTime: '2026-10-12T20:51:46Z', sensorValueDescriptionEn: keli, sensorValueDescriptionFi: 'Kuiva', unit: '***', value: 1.0 },
];
const DATA = parseWeatherData({ dataUpdatedTime: '2026-10-12T20:52:41Z', stations: [{ id: 1013, sensorValues: sensors('Dry') }] });
const NOW = Date.parse('2026-10-12T21:00:00Z');

describe('digitrafficRoad', () => {
  it('reads the paired station\'s surface, with the measured distance', () => {
    expect(digitrafficRoad('C01503', 60.05374, 23.99616, STATIONS, DATA, NOW)).toEqual({
      surface: 'Dry', road_temp: 6.4, air_temp: 5.8, observed_at: '2026-10-12T20:51:46Z',
      station: 'kt51_Inkoo', distance_km: 0.5, source: 'Fintraffic',
    });
  });

  it('says nothing for a camera without a pairing, a faulty sensor, a doubted station, or an old reading', () => {
    expect(digitrafficRoad('NOPE', 60.05, 23.99, STATIONS, DATA, NOW)).toBeNull();
    const faulty = parseWeatherData({ stations: [{ id: 1013, sensorValues: sensors('The sensor has a fault') }] });
    expect(digitrafficRoad('C01503', 60.05, 23.99, STATIONS, faulty, NOW)).toBeNull();
    const doubted = new Map([[1013, { ...STATIONS.get(1013)!, state: 'FAULT_DOUBT' }]]);
    expect(digitrafficRoad('C01503', 60.05, 23.99, doubted, DATA, NOW)).toBeNull();
    expect(digitrafficRoad('C01503', 60.05, 23.99, STATIONS, DATA, Date.parse('2026-10-13T00:00:00Z'))).toBeNull();
  });

  it('refuses a station over 10 km from its camera', () => {
    expect(digitrafficRoad('C01503', 60.25, 23.99, STATIONS, DATA, NOW)).toBeNull();
  });
});
