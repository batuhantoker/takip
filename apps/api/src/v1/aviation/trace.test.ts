import { nearestAirport } from '@takip/connectors/airports';
import { describe, expect, it } from 'vitest';
import { downsample, legEndpoints, parseTrack, type Waypoint } from './trace';

describe('downsample', () => {
  it('leaves a short track untouched', () => {
    expect(downsample([1, 2, 3], 10)).toEqual([1, 2, 3]);
  });

  it('thins to the cap', () => {
    expect(downsample(Array.from({ length: 5000 }, (_, i) => i), 700)).toHaveLength(700);
  });

  // The path has to still start and end where the aircraft did.
  it('keeps the first and last point', () => {
    const src = Array.from({ length: 1000 }, (_, i) => i);
    const out = downsample(src, 50);
    expect(out[0]).toBe(0);
    expect(out.at(-1)).toBe(999);
  });

  it('stays in order', () => {
    const out = downsample(Array.from({ length: 500 }, (_, i) => i), 40);
    expect([...out].sort((a, b) => a - b)).toEqual(out);
  });
});

describe('nearestAirport', () => {
  it('names the airport under a runway position', () => {
    expect(nearestAirport(33.4373, -112.0078)?.iata).toBe('PHX');
  });

  it('returns nothing over open ground', () => {
    expect(nearestAirport(39.5, -99.5)).toBeNull();   // rural Kansas
    expect(nearestAirport(0, -140)).toBeNull();        // mid-Pacific
  });

  it('does not let longitude convergence pull in a distant airport', () => {
    // 0.5° of longitude at 60°N is ~28 km, not the ~56 km it is at the equator.
    expect(nearestAirport(59.9139, 10.7522 + 0.5, 20)).toBeNull();
  });

  it('ignores a nonsense position', () => {
    expect(nearestAirport(NaN, NaN)).toBeNull();
  });
});

describe('legEndpoints', () => {
  const PHX: [number, number] = [-112.0078, 33.4373];
  const LAX: [number, number] = [-118.4081, 33.9425];
  const OPEN: [number, number] = [-105, 35];

  it('names the departure when the leg starts low over an airport', () => {
    const { departure } = legEndpoints([PHX, OPEN, LAX], [900, 34000, 31000], false);
    expect(departure?.iata).toBe('PHX');
  });

  // Coverage that begins at cruise says nothing about where the flight started;
  // the schedule's guess is what produced lines to airports it never saw.
  it('refuses a departure when the leg was picked up in the cruise', () => {
    const { departure } = legEndpoints([PHX, OPEN, LAX], [35000, 34000, 31000], false);
    expect(departure).toBeNull();
  });

  it('names the arrival once the trace ends on the ground', () => {
    const { arrival } = legEndpoints([PHX, OPEN, LAX], [900, 34000, 200], true);
    expect(arrival?.iata).toBe('LAX');
  });

  it('leaves the arrival unknown while still airborne', () => {
    expect(legEndpoints([PHX, OPEN, LAX], [900, 34000, 31000], false).arrival).toBeNull();
  });

  it('treats a ground first sample as a departure, not a missing altitude', () => {
    expect(legEndpoints([PHX, OPEN], [null, 30000], false).departure?.iata).toBe('PHX');
  });

  // N6372D climbing out of Caldwell (not in the airport list) at 175 ft.
  it('does not name a major 21 km away for an aircraft seen just off the ground', () => {
    const caldwell: [number, number] = [-74.29364, 40.876419];
    expect(legEndpoints([caldwell, [-74.4, 40.8]], [175, 1500], false).departure).toBeNull();
  });

  it('still names the airport for a climb-out first seen well clear of it', () => {
    // ~20 km east of PHX at 6,000 ft.
    expect(legEndpoints([[-111.79, 33.44], OPEN], [6000, 30000], false).departure?.iata).toBe('PHX');
  });

  it('finds nothing for a leg that starts and ends away from any airport', () => {
    expect(legEndpoints([OPEN, [-104, 36]], [900, 900], true)).toMatchObject({ departure: null, arrival: null });
  });

  it('ignores a track too short to have endpoints', () => {
    expect(legEndpoints([PHX], [900], true)).toEqual({ departure: null, departureFix: null, arrival: null });
  });

  // RPA3551 seen on the runway at Portland, ME, which the airport list lacks.
  it('keeps where a low start began even when no listed airport is there', () => {
    const pwm: [number, number] = [-70.30086, 43.644166];
    const { departure, departureFix } = legEndpoints([pwm, [-71, 43]], [-375, 8000], false);
    expect(departure).toBeNull();
    expect(departureFix).toEqual({ lng: pwm[0], lat: pwm[1], radiusKm: 8 });
  });

  it('records no departure point for a leg picked up at cruise', () => {
    expect(legEndpoints([PHX, OPEN], [35000, 34000], false).departureFix).toBeNull();
  });
});

describe('parseTrack', () => {
  const wp = (t: number, lat: number | null, lng: number | null, altM: number | null, ground = false): Waypoint => [t, lat, lng, altM, 90, ground];

  it('emits the flown path as [lng, lat], oldest first, with altitudes in feet', () => {
    const p = parseTrack([wp(0, 40.64, -73.78, null, true), wp(60, 40.7, -73.6, 1000), wp(600, 41.5, -72.5, 10668)]);
    expect(p.track).toEqual([[-73.78, 40.64], [-73.6, 40.7], [-72.5, 41.5]]);
    expect(p.altitudes).toEqual([null, 3281, 35000]);
    expect(p.points).toBe(3);
  });

  it('drops waypoints with no usable position', () => {
    expect(parseTrack([wp(0, null, 10, 3000), wp(10, 50, Number.NaN, 3000), wp(20, 50, 10, 3000)]).track).toEqual([[10, 50]]);
  });

  it('thins a long track but keeps its ends', () => {
    const p = parseTrack(Array.from({ length: 2000 }, (_, i) => wp(i, 40 + i / 1000, 10, 9000)), 100);
    expect(p.points).toBe(100);
    expect(p.track[0]).toEqual([10, 40]);
    expect(p.track.at(-1)).toEqual([10, 40 + 1999 / 1000]);
  });

  it('reports the airport a flight left and, once on the ground again, landed at', () => {
    const p = parseTrack([
      wp(0, 33.4373, -112.0078, null, true),
      wp(60, 33.44, -112.0, 250),
      wp(1800, 34, -115, 10363),
      wp(3600, 33.9425, -118.4081, 180),
      wp(3700, 33.9425, -118.4081, null, true),
    ]);
    expect(p.departure?.iata).toBe('PHX');
    expect(p.arrival?.iata).toBe('LAX');
  });

  it('names no departure for a flight first seen at cruise, and no arrival while airborne', () => {
    const p = parseTrack([wp(0, 34, -115, 10363), wp(600, 33.95, -118.3, 900)]);
    expect(p).toMatchObject({ departure: null, departureFix: null, arrival: null });
  });

  it('survives an empty or missing path', () => {
    expect(parseTrack(null)).toEqual({ track: [], altitudes: [], points: 0, departure: null, departureFix: null, arrival: null });
    expect(parseTrack([]).points).toBe(0);
  });
});
