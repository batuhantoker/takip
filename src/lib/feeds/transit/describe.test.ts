import { describe, expect, it } from 'vitest';
import { transitFeatures } from './map-layers';
import { readableRoute, transitAgo, transitTipMeta, transitTitle, transitWhere } from './describe';

describe('transit descriptions', () => {
  it('names a vehicle by a readable route, else by its label', () => {
    expect(transitTitle({ route: '34A', label: '7' })).toBe('Route 34A');
    expect(transitTitle({ route: 'NBU:Line:cb7b555c-f96e-42d5-84bf-a5e08c0145c2', label: '9140' })).toBe('Vehicle 9140');
    expect(transitTitle({})).toBe('Transit vehicle');
    expect(readableRoute('CR-Worcester')).toBe('CR-Worcester');
  });

  it('names a train by its mode and line', () => {
    expect(transitTitle({ route: 'A', mode: 'metro' })).toBe('Metro A');
    expect(transitTitle({ route: '9', mode: 'tram' })).toBe('Tram 9');
    expect(transitTitle({ route: '34A', mode: 'bus' })).toBe('Route 34A');
    expect(transitTitle({ mode: 'metro' })).toBe('Metro');
  });

  it('says where a train placed by its stops is, in place of a speed', () => {
    const mono = (s: string) => `[${s}]`;
    expect(transitWhere({ stop: 'Fulton St', status: 1 })).toBe('At Fulton St');
    expect(transitWhere({ stop: 'Rector St', status: 0, from: 'WTC Cortlandt' })).toBe('Arriving at Rector St');
    expect(transitWhere({ stop: '86 St', from: '59 St', status: 2 })).toBe('Between 59 St and 86 St');
    expect(transitWhere({ stop: '86 St' })).toBe('Heading to 86 St');
    expect(transitWhere({ speed: 3 })).toBeNull();
    expect(transitTipMeta({ feed: 'MTA', stop: '86 St', from: '59 St', status: 2 }, mono)).toBe('MTA · Between 59 St and 86 St');
    expect(transitTipMeta({ feed: 'Metro İstanbul', stop: 'Şişli', from: 'Osmanbey', status: 2, scheduled: true }, mono)).toBe('Metro İstanbul · Between Osmanbey and Şişli · scheduled');
  });

  it('says who runs it and how fast, escaping feed text', () => {
    const mono = (s: string) => `[${s}]`;
    expect(transitTipMeta({ operator: '<b>Ops</b>', speed: 10 }, mono)).toBe('&lt;b&gt;Ops&lt;/b&gt; · [36 km/h]');
    expect(transitTipMeta({ feed: 'MBTA', speed: 0.2 }, mono)).toBe('MBTA · stopped');
  });

  it('says how long ago in seconds, then minutes', () => {
    expect(transitAgo(12)).toBe('12 s ago');
    expect(transitAgo(600)).toBe('10 min ago');
    expect(transitAgo(undefined)).toBeUndefined();
  });
});

describe('transitFeatures', () => {
  it('carries the feed name and leaves out what the feed did not send', () => {
    const [f] = transitFeatures({
      feeds: [{ id: 'mbta', name: 'MBTA', license: 'https://example.invalid/terms', ok: true, count: 1 }],
      vehicles: [{ key: 'mbta:1', feed: 0, lng: -71.06, lat: 42.36, route: '74', age: 8 }],
      skipped: 0,
      timestamp: '2026-10-15T00:00:00Z',
    });
    expect(f.geometry.coordinates).toEqual([-71.06, 42.36]);
    expect(f.properties).toEqual({ key: 'mbta:1', route: '74', age: 8, feed: 'MBTA', license: 'https://example.invalid/terms' });
    expect('bearing' in (f.properties ?? {})).toBe(false);
  });
});
