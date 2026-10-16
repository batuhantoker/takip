import { describe, expect, it } from 'vitest';
import { parseCta } from './cta';
import { parseFgc } from './fgc';
import { HAFAS_RADARS, hafasRequest, parseHafasRadar } from './hafas';
import { parseLaMetro } from './lametro';
import { parseTfl, tflStop } from './tfl';

const NOW = 1_792_100_000;

describe('parseLaMetro', () => {
  it('keeps the latest message per train on a trip, with the line letter and mode', () => {
    const msg = (id: string, lat: number, extra: object = {}) => ({ id, vehicle: { position: { latitude: lat, longitude: -118.25, bearing: 90, speed: 12 }, timestamp: String(NOW), vehicle: { id, label: id }, ...extra } });
    const trip = { trip: { tripId: 't1', routeId: '802' }, currentStatus: 'IN_TRANSIT_TO' };
    const out = parseLaMetro([msg('1190-1207', 34.05, trip), msg('1190-1207', 34.06, trip), msg('yard-1', 34.0)]);
    expect(out).toEqual([{ id: '1190-1207', lat: 34.06, lng: -118.25, route: 'B', mode: 'metro', trip: 't1', label: '1190-1207', bearing: 90, speed: 12, status: 2, t: NOW }]);
  });
});

describe('parseCta', () => {
  it("reads each line's trains, with a compass bearing and the next station", () => {
    const text = JSON.stringify({ status: 'OK', dataObject: [{ Line: 'R', Markers: [
      { Position: { Lat: 41.99, Lng: -87.66 }, RunNumber: '824', Direction: Math.PI / 2, LineName: 'Red', Predictions: [[41300, 'Loyola', '2 min', '']] },
      { Position: { Lat: 0, Lng: 0 }, RunNumber: '900', LineName: 'Red' },
    ] }] });
    expect(parseCta(text)).toEqual([{ id: 'R824', lat: 41.99, lng: -87.66, label: '824', route: 'Red', mode: 'metro', bearing: 0, stop: 'Loyola', status: 2 }]);
  });

  it('throws on a reply that is not the map', () => {
    expect(() => parseCta('{"status":"Error"}')).toThrow(/CTA/);
  });
});

describe('parseTfl', () => {
  it("takes each train's soonest station, on its line and direction", () => {
    const at = (s: number) => new Date((NOW + s) * 1000).toISOString();
    const base = { vehicleId: '201', lineId: 'central', lineName: 'Central', direction: 'outbound', destinationNaptanId: '940GZZLUEPG' };
    const { atStops, trips } = parseTfl([
      { ...base, naptanId: '940GZZLUBND', expectedArrival: at(90), currentLocation: 'Between Marble Arch and Bond Street' },
      { ...base, naptanId: '940GZZLUOXC', expectedArrival: at(200), currentLocation: 'Between Marble Arch and Bond Street' },
      { ...base, vehicleId: '000', naptanId: '940GZZLUOXC', expectedArrival: at(10) },
      { ...base, vehicleId: '305', naptanId: '940GZZLUTCR', expectedArrival: at(5), currentLocation: 'At Platform' },
    ], NOW);
    const bond = tflStop('940GZZLUBND', 'central', 'outbound');
    expect(atStops.map(f => [f.stopId, f.status, f.route])).toEqual([[bond, 2, 'Central'], [tflStop('940GZZLUTCR', 'central', 'outbound'), 1, 'Central']]);
    expect(trips.get(atStops[0].id)?.next).toEqual([{ stop: bond, arrive: NOW + 90 }]);
  });
});

describe('HAFAS radar', () => {
  it("asks for the city's box on its own wall clock, signing the body where the endpoint wants it", () => {
    const { url, body } = hafasRequest(HAFAS_RADARS['hafas-munich'], new Date(Date.UTC(2026, 9, 15, 22, 30, 5)));
    const req = JSON.parse(body).svcReqL[0].req;
    expect(req).toMatchObject({ date: '20261016', time: '003005', rect: { llCrd: { x: 11_400_000, y: 48_050_000 } } });
    expect(url).toMatch(/\?mic=[0-9a-f]{32}&mac=[0-9a-f]{32}$/);
    expect(hafasRequest(HAFAS_RADARS['hafas-vienna']).url).toBe(HAFAS_RADARS['hafas-vienna'].endpoint);
  });

  it('keeps the underground lines, as estimates', () => {
    const text = JSON.stringify({ svcResL: [{ err: 'OK', res: { common: { prodL: [{ name: 'Metro M3' }, { name: 'Bus 5C' }] }, jnyL: [
      { jid: 'j1', pos: { x: 12_568_000, y: 55_676_000 }, prodX: 0 },
      { jid: 'j2', pos: { x: 12_5, y: 55_6 }, prodX: 1 },
      { jid: 'j3', prodX: 0 },
    ] } }] });
    expect(parseHafasRadar(text, HAFAS_RADARS['hafas-copenhagen'].lines, NOW)).toEqual([
      { id: 'j1', lat: 55.676, lng: 12.568, route: 'M3', mode: 'metro', estimated: true, t: NOW },
    ]);
    expect(() => parseHafasRadar('{"svcResL":[{"err":"AUTH"}]}', /./, NOW)).toThrow(/AUTH/);
  });
});

describe('parseFgc', () => {
  it('calls the L lines metro and the rest rail', () => {
    const text = JSON.stringify({ results: [
      { id: 'r1', ut: 'u1', lin: 'L7', geo_point_2d: { lon: 2.14, lat: 41.4 } },
      { id: 'r2', lin: 'S2', geo_point_2d: { lon: 2.07, lat: 41.47 } },
      { id: 'r3', lin: 'S1' },
    ] });
    expect(parseFgc(text, NOW).map(v => [v.id, v.route, v.mode])).toEqual([['u1', 'L7', 'metro'], ['r2', 'S2', 'rail']]);
  });
});
