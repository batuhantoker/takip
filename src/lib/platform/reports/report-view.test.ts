import { describe, expect, it } from 'vitest';
import { APP_VERSION } from '@/lib/platform/app-version';
import type { HistorySession } from '@/lib/history/session';
import { atMa } from '@/lib/history/paleo/deep-time';
import type { ReplaySession } from '@/lib/map/replay/session';
import { buildReportView, reportMode, type ViewInputs } from './report-view';
import { siteLink, summarizeView } from './view-summary';

const AT = Date.UTC(2026, 9, 15, 8, 30);

const INPUTS: ViewInputs = {
  center: { lat: 41.0082, lng: 28.9784 },
  zoom: 9.5,
  layers: { flights: true, ships: true, cctv: false },
  mode: { kind: 'live' },
  space: null,
  track: null,
  baseMap: 'dark',
  projection: 'globe',
  theme: 'core',
  panel: 'layers',
};

const clock = (t: number) => ({ time: () => t });
const replay = (t: number) => ({ clock: clock(t) }) as unknown as ReplaySession;
const history = (t: number, deep = false, deepT = 0) => ({ clock: clock(t), deepClock: clock(deepT), deep: () => deep }) as unknown as HistorySession;

describe('reportMode', () => {
  it('reads Replay’s clock, History’s calendar or its deep time, or says live', () => {
    expect(reportMode(null, null)).toEqual({ kind: 'live' });
    expect(reportMode(replay(AT), null)).toEqual({ kind: 'replay', at: AT });
    expect(reportMode(null, history(AT))).toEqual({ kind: 'history', at: AT });
    expect(reportMode(null, history(AT, true, atMa(250)))).toEqual({ kind: 'deep', ma: 250 });
  });
});

describe('buildReportView', () => {
  it('takes the camera over the page’s state, and links back to the view', () => {
    const view = buildReportView({ ...INPUTS, mode: { kind: 'replay', at: AT } }, {
      camera: { lat: 41.123456, lng: 29.654321, zoom: 11.234, bearing: 12.34, pitch: 40.06 },
      viewport: { width: 1440, height: 900 },
      point: { lat: 41.1, lng: 29.6 },
    });
    expect(view).toEqual({
      link: '/?lat=41.1235&lon=29.6543&zoom=11.23&layers=flights%2Cships',
      center: { lat: 41.12346, lng: 29.65432 },
      zoom: 11.23,
      bearing: 12.3,
      pitch: 40.1,
      mode: 'replay',
      time: '2026-10-15T08:30:00.000Z',
      baseMap: 'dark',
      projection: 'globe',
      theme: 'core',
      layers: ['flights', 'ships'],
      panel: 'layers',
      point: { lat: 41.1, lng: 29.6 },
      viewport: { width: 1440, height: 900 },
      version: APP_VERSION,
    });
  });

  it('falls back to the page’s link before the map has a centre, and to the page’s zoom without a camera', () => {
    const view = buildReportView({ ...INPUTS, center: null, zoom: 2.5 }, { fallbackLink: '/?oi=abc' });
    expect(view).toMatchObject({ link: '/?oi=abc', zoom: 2.5, mode: 'live' });
    expect(view).not.toHaveProperty('center');
    expect(view).not.toHaveProperty('bearing');
    expect(view).not.toHaveProperty('time');
  });

  it('writes deep time as an age, and History as a moment', () => {
    expect(buildReportView({ ...INPUTS, mode: { kind: 'deep', ma: 250 } })).toMatchObject({ mode: 'history', time: '250.0 Ma' });
    expect(buildReportView({ ...INPUTS, mode: { kind: 'history', at: Date.UTC(1453, 4, 29) } }).time).toBe('1453-05-29T00:00:00.000Z');
    // Past what Date can hold: the time is left out rather than failing the report.
    expect(buildReportView({ ...INPUTS, mode: { kind: 'history', at: 1e20 } })).not.toHaveProperty('time');
  });

  it('notes the space view while it is open', () => {
    expect(buildReportView({ ...INPUTS, space: 'moon' }).space).toBe('moon');
  });

  it('carries what the map follows, in the view and its link', () => {
    const view = buildReportView({ ...INPUTS, track: 'aircraft:4bb1c2' });
    expect(view).toMatchObject({ track: 'aircraft:4bb1c2', link: '/?lat=41.0082&lon=28.9784&zoom=9.50&layers=flights%2Cships&track=aircraft%3A4bb1c2' });
    expect(summarizeView(view)).toContain('following aircraft:4bb1c2');
  });
});

describe('summarizeView', () => {
  it('puts mode and time, zoom, base map and layers first', () => {
    const view = buildReportView({ ...INPUTS, mode: { kind: 'replay', at: AT } }, { viewport: { width: 1440, height: 900 }, point: { lat: 41.1, lng: 29.6 } });
    expect(summarizeView(view)).toEqual([
      'Replay at Oct 15, 2026, 08:30 UTC', 'zoom 9.5', 'dark, globe', 'flights, ships', 'layers open', 'clicked 41.1000, 29.6000', '1440×900', APP_VERSION,
    ]);
  });

  it('shows History’s year or age, a long layer list in short, and copes with an empty view', () => {
    const layers = Object.fromEntries(['a', 'b', 'c', 'd', 'e'].map(key => [key, true]));
    expect(summarizeView(buildReportView({ ...INPUTS, layers, panel: null, mode: { kind: 'history', at: Date.UTC(1453, 4, 29) } })).slice(0, 4))
      .toEqual(['History at 1453', 'zoom 9.5', 'dark, globe', 'a, b, c +2 more']);
    expect(summarizeView(buildReportView({ ...INPUTS, mode: { kind: 'deep', ma: 66.04 } }))[0]).toBe('History at 66.04 Ma');
    expect(summarizeView({ mode: 'history', time: '-000500-01-01T00:00:00.000Z' })).toEqual(['History at 501 BC']);
    expect(summarizeView({ layers: [] })).toEqual(['no layers']);
    expect(summarizeView({})).toEqual([]);
  });
});

describe('siteLink', () => {
  it('opens only paths on this site', () => {
    expect(siteLink({ link: '/?lat=1.0000&lon=2.0000' })).toBe('/?lat=1.0000&lon=2.0000');
    for (const link of ['https://evil.example/', '//evil.example', '/\\evil.example', 'javascript:alert(1)', '/\t/evil.example', undefined]) {
      expect(siteLink({ link }), String(link)).toBeNull();
    }
  });
});
