import { describe, expect, it } from 'vitest';
import { pickConsensus, utcOffset, type IpCandidate } from './consensus';

// What five providers said for one Spectrum address in Cincinnati on 2026-10-21.
const SPECTRUM: IpCandidate[] = [
  { source: 'ipapi.co', lat: 41.771, lon: -88.153, city: 'Naperville', tz: 'America/Chicago' },
  { source: 'freeipapi.com', lat: 40.8373, lon: -81.2596, city: 'Louisville' },
  { source: 'ip-api.com', lat: 39.1138, lon: -84.4788, city: 'Dayton', tz: 'America/New_York', as: 'AS10796 Charter Communications Inc' },
  { source: 'ipinfo.io', lat: 39.2465, lon: -84.5836, city: 'Northbrook', tz: 'America/New_York' },
  { source: 'ipwho.is', lat: 39.1271, lon: -84.5144, city: 'Cincinnati', tz: 'America/New_York' },
];
const OCTOBER = new Date('2026-10-21T12:00:00Z');

describe('pickConsensus', () => {
  it('takes the answer most providers agree on, not the first', () => {
    const best = pickConsensus(SPECTRUM, null, OCTOBER)!;
    expect(best.city).toBe('Cincinnati');
    expect(best).toMatchObject({ agreement: 3, answered: 5 });
  });

  it('borrows the network details from another provider when the winner has none', () => {
    expect(pickConsensus(SPECTRUM, null, OCTOBER)!.as).toBe('AS10796 Charter Communications Inc');
  });

  it('drops answers from a zone with another offset than the browser’s', () => {
    const [naperville, louisville] = SPECTRUM;
    const best = pickConsensus([naperville, louisville], 'America/New_York', OCTOBER)!;
    expect(best.city).toBe('Louisville');
    expect(best.agreement).toBe(1);
  });

  it('keeps a zone with the same offset under another name', () => {
    const detroit = { source: 'x', lat: 42.33, lon: -83.05, city: 'Detroit', tz: 'America/Detroit' };
    expect(pickConsensus([detroit], 'America/New_York', OCTOBER)!.city).toBe('Detroit');
  });

  it('ignores the browser zone when it would drop every answer', () => {
    expect(pickConsensus([SPECTRUM[0]], 'Europe/Istanbul', OCTOBER)!.city).toBe('Naperville');
  });

  it('ignores a browser zone the runtime does not know', () => {
    expect(pickConsensus(SPECTRUM, 'Mars/Olympus', OCTOBER)!.city).toBe('Cincinnati');
  });

  it('with no agreement, takes the answer closest to the rest', () => {
    const best = pickConsensus(SPECTRUM.slice(0, 3), null, OCTOBER)!;
    expect(best.city).toBe('Dayton');
    expect(best.agreement).toBe(1);
  });

  it('answers nothing without candidates', () => {
    expect(pickConsensus([], 'America/New_York')).toBeNull();
  });
});

describe('utcOffset', () => {
  it('follows daylight saving', () => {
    expect(utcOffset('America/New_York', OCTOBER)).toBe('GMT-04:00');
    expect(utcOffset('America/New_York', new Date('2026-01-15T12:00:00Z'))).toBe('GMT-05:00');
  });

  it('is null for an unknown zone', () => {
    expect(utcOffset('Mars/Olympus', OCTOBER)).toBeNull();
  });
});
