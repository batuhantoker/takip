import { describe, expect, it } from 'vitest';
import { toColumns } from '@/lib/core/columns';
import { flightData } from './flight-lists';

const plane = (icao24: string, extra: Record<string, unknown> = {}) => ({
  callsign: `TK${icao24}`, lat: 41.27, lng: 28.75, alt: 10668, heading: 270, speed_knots: 450.5, model: 'Unknown', icao24,
  registration: 'N/A', squawk: '2000', airline_code: 'THY', aircraft_category: 'plane', category: 'commercial', grounded: false, type: 'flight', ...extra,
});

describe('flight lists as columns', () => {
  it('gives the page the same rows the JSON route does, optional fields included', () => {
    const json = {
      commercial_flights: [plane('4bb1c2'), plane('4bb1c3', { grounded: true })],
      private_flights: [],
      private_jets: [plane('a1b2c3', { category: 'jet' })],
      military_flights: [plane('ae1f72', { category: 'military', nac_p: 10 })],
      gps_jamming: [{ lat: 31, lng: -87, ratio: 0.13 }],
      total: 4, source: 'adsblol', timestamp: '2026-10-21T14:00:00.000Z',
    };
    const wire = JSON.parse(JSON.stringify({
      ...json, format: 'flights',
      commercial_flights: toColumns(json.commercial_flights), private_flights: toColumns(json.private_flights),
      private_jets: toColumns(json.private_jets), military_flights: toColumns(json.military_flights),
    }));
    expect(flightData(wire)).toEqual(json);
  });

  it('passes the plain JSON and errors through untouched', () => {
    const plain = { commercial_flights: [plane('x')], total: 1 };
    expect(flightData(plain)).toBe(plain);
    expect(flightData({ error: 'Failed to fetch flight data' })).toEqual({ error: 'Failed to fetch flight data' });
  });
});
