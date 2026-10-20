import { describe, expect, it } from 'vitest';
import { airlineName, searchFlights } from './flight-search';

const row = (icao24: string, callsign: string, extra: Record<string, unknown> = {}) =>
  ({ icao24, callsign, registration: 'N/A', model: 'Unknown', lat: 41, lng: 29, alt: 10_000, grounded: false, ...extra });

const FEED = {
  commercial_flights: [
    row('4bb1c2', 'THY1', { registration: 'TC-JJE', model: 'B77W' }),
    row('4bb1c3', 'THY12', { lat: 51, lng: 0 }),
    row('4bb1c4', 'THY123', { grounded: true }),
    row('4bb1c9', 'THY19', { lat: 40, lng: 28 }),
    row('4ba9d1', 'PGT1'),
    row('400a01', 'BAW286', { registration: 'G-STBA' }),
    row('aabbcc', 'aabbcc'),
    row('ddeeff', 'UNKNOWN', { registration: 'N12345' }),
  ],
  military_flights: [row('ae1234', 'RCH123')],
};

const ids = (q: string, opts?: Parameters<typeof searchFlights>[2]) => searchFlights(FEED, q, opts).hits.map(h => h.icao24);

describe('searchFlights', () => {
  it('finds a callsign whole first, then the callsigns it starts', () => {
    expect(ids('THY1')).toEqual(['4bb1c2', '4bb1c3', '4bb1c9', '4bb1c4']);
    expect(searchFlights(FEED, 'thy1').hits[0]).toMatchObject({ match: 'callsign', exact: true, airline: 'Turkish Airlines', model: 'B77W' });
  });

  it('reads a flight number as its airline callsign', () => {
    expect(ids('TK1')[0]).toBe('4bb1c2');
    expect(ids('TK 0001')[0]).toBe('4bb1c2');
    expect(ids('BA286')).toEqual(['400a01']);
    expect(searchFlights(FEED, 'PC1').hits[0]).toMatchObject({ icao24: '4ba9d1', match: 'flight', exact: true });
  });

  it('finds registrations with or without the hyphen, and the 24-bit address', () => {
    expect(ids('TCJJE')).toEqual(['4bb1c2']);
    expect(ids('g-stba')).toEqual(['400a01']);
    expect(ids('N12345')).toEqual(['ddeeff']);
    expect(ids('4BA9D1')).toEqual(['4ba9d1']);
  });

  it('never matches the address or UNKNOWN the feed puts in for a missing callsign', () => {
    expect(searchFlights(FEED, 'UNKNOWN').hits).toEqual([]);
    expect(searchFlights(FEED, 'aabbcc').hits[0]).toMatchObject({ match: 'icao24', callsign: null });
  });

  it('lists an airline by its code or name, airborne and nearest first', () => {
    const near = { lat: 40, lng: 28 };
    expect(ids('TK', { near })).toEqual(['4bb1c9', '4bb1c2', '4bb1c3', '4bb1c4']);
    expect(ids('turkish', { near, limit: 2 })).toEqual(['4bb1c9', '4bb1c2']);
    expect(searchFlights(FEED, 'turkish', { limit: 2 }).total).toBe(4);
    expect(ids('pegasus')).toEqual(['4ba9d1']);
  });

  it('ignores one character and nonsense', () => {
    expect(searchFlights(FEED, 'T').hits).toEqual([]);
    expect(searchFlights(FEED, 'zzzz').hits).toEqual([]);
  });
});

describe('airlineName', () => {
  it('names the operator from the callsign prefix', () => {
    expect(airlineName('BAW286')).toBe('British Airways');
    expect(airlineName('N12345')).toBeNull();
  });
});
