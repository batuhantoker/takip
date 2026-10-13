import { describe, it, expect } from 'vitest';
import { bearing, flightPathFeatures, greatCircle, routeFor, unwrap } from './path';
import type { Airport } from './watch';

const ap = (icao: string, iata: string, lat: number, lng: number): Airport => ({ icao, iata, lat, lng });
const DTW = ap('KDTW', 'DTW', 42.2124, -83.3534);
const FLL = ap('KFLL', 'FLL', 26.0742, -80.1506);
const SLC = ap('KSLC', 'SLC', 40.7884, -111.9778);
const ORD = ap('KORD', 'ORD', 41.9742, -87.9073);
const GYD = ap('UBBB', 'GYD', 40.4675, 50.0467);

const kinds = (fc: GeoJSON.FeatureCollection) => fc.features.map(f => f.properties?.kind);
const line = (fc: GeoJSON.FeatureCollection, kind: string) =>
  (fc.features.find(f => f.properties?.kind === kind)?.geometry as GeoJSON.LineString | undefined)?.coordinates;

describe('routeFor', () => {
  const sched = { found: true, origin: DTW, destination: FLL };

  it('keeps the schedule, origin included, when the aircraft is on its corridor', () => {
    expect(routeFor(null, sched, [-81.7, 34.1])).toEqual({ origin: DTW, destination: FLL, scheduled: true });
  });

  it('drops a schedule for a different leg than the one seen departing', () => {
    expect(routeFor({ departure: SLC, arrival: null }, sched, [-81.7, 34.1]))
      .toEqual({ origin: SLC, destination: null, scheduled: false });
  });

  it('drops AZG4862 filed Chicago–Baku while over Jordan', () => {
    const r = routeFor(null, { found: true, origin: ORD, destination: GYD }, [38.9691, 32.0198]);
    expect(r).toEqual({ origin: null, destination: null, scheduled: false });
  });

  // RPA3551: on the BOS–EWR corridor, but its track starts on the runway at Portland.
  it('checks the schedule origin against where the leg began, airport listed or not', () => {
    const BOS = ap('KBOS', 'BOS', 42.3656, -71.0096);
    const EWR = ap('KEWR', 'EWR', 40.6895, -74.1745);
    const fromPortland = { departure: null, arrival: null, departureFix: { lng: -70.30086, lat: 43.644166, radiusKm: 8 } };
    expect(routeFor(fromPortland, { found: true, origin: BOS, destination: EWR }, [-74.54, 41.05]).scheduled).toBe(false);
    const fromBoston = { ...fromPortland, departureFix: { lng: -71.0, lat: 42.37, radiusKm: 8 } };
    expect(routeFor(fromBoston, { found: true, origin: BOS, destination: EWR }, [-74.54, 41.05]).destination?.iata).toBe('EWR');
  });

  it('ignores a lookup that found nothing', () => {
    expect(routeFor(null, { found: false }, [-81.7, 34.1]).scheduled).toBe(false);
  });
});

describe('bearing', () => {
  it('reads due north and due east', () => {
    expect(bearing([0, 0], [0, 10])).toBeCloseTo(0, 5);
    expect(bearing([0, 0], [10, 0])).toBeCloseTo(90, 5);
  });
});

describe('greatCircle', () => {
  it('starts and ends on the airports', () => {
    const pts = greatCircle([DTW.lng, DTW.lat], [FLL.lng, FLL.lat]);
    expect(pts[0][0]).toBeCloseTo(DTW.lng, 6);
    expect(pts.at(-1)![1]).toBeCloseTo(FLL.lat, 6);
    expect(pts.length).toBeGreaterThan(10);
  });
});

describe('unwrap', () => {
  it('carries a line across the antimeridian instead of round the world', () => {
    const out = unwrap([[178, 10], [-179, 11], [-176, 12]]);
    expect(out.map(p => p[0])).toEqual([178, 181, 184]);
  });

  it('pins the first point to a given world copy', () => {
    expect(unwrap([[-179, 0]], 181)[0][0]).toBe(181);
  });
});

describe('flightPathFeatures', () => {
  const track: [number, number][] = [[-83.3, 42.1], [-82.5, 39], [-82, 36]];

  it('joins the aircraft to its track when it is ahead of the track end', () => {
    const fc = flightPathFeatures({ track, here: [-81.8, 35], heading: 170, origin: DTW, destination: FLL });
    expect(line(fc, 'flown')!.at(-1)).toEqual([-81.8, 35]);
    expect(line(fc, 'ahead')![0]).toEqual([-81.8, 35]);
    expect(kinds(fc).filter(k => k === 'airport')).toHaveLength(2);
  });

  // The feed position can be older than the trace; joining it would double back.
  it('does not join an aircraft lagging behind the track end', () => {
    const fc = flightPathFeatures({ track, here: [-82.4, 38], heading: 170, origin: DTW, destination: FLL });
    expect(line(fc, 'flown')).toEqual(track);
    expect(line(fc, 'ahead')![0]).toEqual([-82, 36]);
  });

  it('draws nothing ahead once the aircraft has landed', () => {
    const fc = flightPathFeatures({ track, here: [-82, 36], heading: 170, origin: DTW, destination: FLL, landed: true });
    expect(kinds(fc)).not.toContain('ahead');
  });

  it('draws just the flown track when the destination is unknown', () => {
    expect(kinds(flightPathFeatures({ track, here: [-81.8, 35], heading: 170, origin: null, destination: null })))
      .toEqual(['flown']);
  });

  it('draws nothing at all with no track and no route', () => {
    expect(flightPathFeatures({ track: [], here: [0, 0], heading: 0, origin: null, destination: null }).features).toEqual([]);
  });
});
