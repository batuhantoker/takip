import { describe, expect, it } from 'vitest';
import { GDACS_VO_URL, mapGdacsVolcano, parseGdacsVolcanoes, type GdacsFeature } from './gdacs-volcanoes';

// Verbatim from geteventlist/MAP?eventtype=VO, 2026-10-12 (fields we read).
const KANLAON: GdacsFeature = {
  geometry: { type: 'Point', coordinates: [123.132, 10.412] },
  properties: {
    eventtype: 'VO', eventid: 1000152, episodeid: 1, eventname: 'Kanlaon',
    htmldescription: 'Orange Eruption Kanlaon in Philippines at: 10 Oct 2026 05:58.',
    alertlevel: 'Orange', iscurrent: 'true', country: 'Philippines', fromdate: '2026-10-10T05:58:00',
    url: { report: 'https://www.gdacs.org/report.aspx?eventid=1000152&episodeid=1&eventtype=VO' },
  },
};

describe('mapGdacsVolcano', () => {
  it('maps a current eruption', () => {
    expect(mapGdacsVolcano(KANLAON)).toEqual({
      id: 'gdacs-VO-1000152-1',
      title: 'Orange Eruption Kanlaon in Philippines at: 10 Oct 2026 05:58.',
      category: 'volcanoes',
      type: 'Volcano Eruption',
      icon: 'volcano',
      severity: 'medium',
      lat: 10.412,
      lng: 123.132,
      date: '2026-10-10T05:58:00Z',
      area: 'Philippines',
      source: 'https://www.gdacs.org/report.aspx?eventid=1000152&episodeid=1&eventtype=VO',
      provider: 'GDACS',
    });
  });

  it('drops past events and other types', () => {
    expect(mapGdacsVolcano({ ...KANLAON, properties: { ...KANLAON.properties, iscurrent: 'false' } })).toBeNull();
    expect(mapGdacsVolcano({ ...KANLAON, properties: { ...KANLAON.properties, eventtype: 'EQ' } })).toBeNull();
    expect(mapGdacsVolcano({ ...KANLAON, geometry: null })).toBeNull();
  });
});

describe('parseGdacsVolcanoes', () => {
  it('lists an eruption GDACS repeats only once', () => {
    expect(parseGdacsVolcanoes({ features: [KANLAON, KANLAON] })).toHaveLength(1);
    expect(() => parseGdacsVolcanoes({})).toThrow();
  });
});

const liveIt = process.env.RUN_LIVE_TESTS === '1' ? it : it.skip;
liveIt('reads the live volcano list', async () => {
  const res = await fetch(GDACS_VO_URL, { signal: AbortSignal.timeout(20_000) });
  expect(res.ok).toBe(true);
  for (const e of parseGdacsVolcanoes(await res.json())) expect(e.id).toMatch(/^gdacs-VO-\d+-\d+$/);
}, 30_000);
