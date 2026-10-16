import { describe, expect, it } from 'vitest';
import { nearestContacts } from './contacts';

const DATA = {
  commercial_flights: [
    { icao24: 'self', callsign: 'TK1', lat: 41, lng: 29, alt: 10000 },
    { icao24: 'a', callsign: 'PGT2 ', lat: 41.5, lng: 29, alt: 9000 },
    { icao24: 'b', callsign: 'THY3', lat: 41.05, lng: 29.05, grounded: true },
    { icao24: 'far', callsign: 'FAR', lat: 45, lng: 29 },
  ],
  military_flights: [{ icao24: 'm', callsign: '', lat: 40.8, lng: 28.6, alt: 3000 }],
  maritime_ships: [{ mmsi: 271000001, name: 'KARADENIZ', lat: 41.01, lng: 29.01, speed: 12 }],
};

describe('nearestContacts', () => {
  const contacts = nearestContacts(DATA, { kind: 'aircraft', id: 'self', lat: 41, lng: 29 });

  it('lists airborne aircraft and ships within reach, nearest first, without the subject', () => {
    expect(contacts.map(c => `${c.kind}:${c.id}`)).toEqual(['ship:271000001', 'aircraft:m', 'aircraft:a']);
  });

  it('says how far and which way, and names an aircraft by callsign or address', () => {
    const [ship, mil, north] = contacts;
    expect(ship).toMatchObject({ name: 'KARADENIZ', speed: 12 });
    expect(ship.km).toBeCloseTo(1.4, 1);
    expect(mil.name).toBe('m');
    expect(north).toMatchObject({ name: 'PGT2', alt: 9000 });
    expect(north.bearing).toBeCloseTo(0, 0);
    expect(north.km).toBeCloseTo(55.6, 0);
  });
});
