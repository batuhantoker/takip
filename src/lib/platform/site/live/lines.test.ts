import { describe, expect, it } from 'vitest';
import { createTranslator } from '@/lib/core/i18n/translator';
import { auroraLine, issLine, launchLine, quakeLine } from './lines';

const NOW = Date.parse('2026-10-19T12:00:00Z');
const en = createTranslator('en', {});

describe('quakeLine', () => {
  it('counts M4.5+ in the last day and names the strongest', () => {
    const line = quakeLine({ earthquakes: [
      { magnitude: 4.6, place: '10 km N of A', time: NOW - 3_600_000 },
      { magnitude: 6.1, place: '85 km SSE of B', time: NOW - 7_200_000 },
      { magnitude: 2.7, place: 'C', time: NOW - 60_000 },
      { magnitude: 7.0, place: 'too old', time: NOW - 90_000_000 },
    ] }, NOW, en);
    expect(line).toEqual({ text: '2 earthquakes of magnitude 4.5 or more in the last 24 hours. The strongest: M6.1, 85 km SSE of B.', asOf: '12:00 UTC' });
  });

  it('says so when nothing reached M4.5', () => {
    expect(quakeLine({ earthquakes: [{ magnitude: 3.1, place: 'D', time: NOW }] }, NOW, en)?.text).toMatch(/^No earthquake of magnitude 4.5/);
  });

  it('has nothing to say without data', () => {
    expect(quakeLine(null, NOW, en)).toBeNull();
  });

  it('formats numbers for the reader’s language', () => {
    const tr = createTranslator('tr', { 'No earthquake of magnitude 4.5 or more in the last 24 hours. The strongest: M{mag}, {place}.': 'En güçlüsü: M{mag}, {place}.' });
    expect(quakeLine({ earthquakes: [{ magnitude: 3.1, place: 'D', time: NOW }] }, NOW, tr)?.text).toBe('En güçlüsü: M3,1, D.');
  });
});

describe('launchLine', () => {
  it('picks the next launch still ahead', () => {
    const line = launchLine({ launches: [
      { name: 'Gone', net: '2026-10-19T11:00:00Z', provider: 'X', location: null, status: 'Go' },
      { name: 'Later', net: '2026-10-22T10:00:00Z', provider: 'Y', location: null, status: 'TBD' },
      { name: 'Falcon 9 | Starlink', net: '2026-10-20T14:30:00Z', provider: 'SpaceX', location: 'Cape Canaveral, FL, USA', status: 'Go' },
    ] }, NOW, en);
    expect(line?.text).toBe('Next launch: Falcon 9 | Starlink, Tue, Oct 20 at 14:30 UTC. By SpaceX, from Cape Canaveral, FL, USA.');
  });

  it('flags a date that is not confirmed', () => {
    expect(launchLine({ launches: [{ name: 'L', net: '2026-11-01T00:00:00Z', provider: null, location: null, status: 'TBD' }] }, NOW, en)?.text)
      .toContain('The date is not yet confirmed.');
  });
});

describe('auroraLine', () => {
  it('reads the highest chance', () => {
    expect(auroraLine({ max_pct: 61.6, forecast_at: '2026-10-19T12:35:00Z' }, NOW, en)?.text)
      .toBe('NOAA’s nowcast for 12:35 UTC puts the highest chance of seeing the aurora anywhere at 62%.');
  });
});

describe('issLine', () => {
  it('gives the position at the time it was computed', () => {
    expect(issLine({ satellites: [{ name: 'ISS (ZARYA)', lat: -12.34, lng: 45.6, alt: 418 }], source: 'celestrak', timestamp: '2026-10-19T11:58:00Z' }, NOW, en)?.text)
      .toBe('At 11:58 UTC the ISS was over 12.3° S, 45.6° E, 418 km up, moving at about 7.7 km a second.');
  });

  it('says nothing from the years-old fallback element set', () => {
    expect(issLine({ satellites: [{ name: 'ISS (FALLBACK)', lat: 1, lng: 1, alt: 400 }], source: 'emergency-fallback' }, NOW, en)).toBeNull();
  });
});
