import { describe, expect, it } from 'vitest';
import { parseAeaAtom, parseBcEvacuations, parseSaskAlert } from './canada-civil';

describe('parseBcEvacuations', () => {
  // Shaped from the EMCR Evacuation_Orders_and_Alerts layer, 2026-10-12.
  const order = {
    attributes: {
      OBJECTID: 5, EVENT_NAME: 'Bradley Creek Wildfire', EVENT_TYPE: 'Fire', ORDER_ALERT_NAME: 'Electoral Area F',
      ORDER_ALERT_STATUS: 'Order', ISSUING_AGENCY: 'Columbia Shuswap Regional District',
      MULTI_SOURCED_POPULATION: 12, MULTI_SOURCED_HOMES: 0, DATE_MODIFIED: Date.parse('2026-10-06T00:00:00Z'),
    },
    geometry: { rings: [[[-119.4, 50.3], [-119.3, 50.3], [-119.3, 50.4], [-119.4, 50.4], [-119.4, 50.3]]] },
  };

  it('maps a standing order to a high-severity event at its polygon centre', () => {
    expect(parseBcEvacuations({ features: [order] })).toEqual([{
      id: 'bc-evac-5',
      title: 'Evacuation order — Bradley Creek Wildfire (12 people)',
      category: 'civilEmergency',
      type: 'Evacuation Order',
      icon: 'alert',
      severity: 'high',
      lat: expect.closeTo(50.35, 6),
      lng: expect.closeTo(-119.35, 6),
      date: '2026-10-06T00:00:00.000Z',
      area: 'Electoral Area F — Columbia Shuswap Regional District',
      source: 'https://www.emergencyinfobc.gov.bc.ca/',
      provider: 'B.C. EMCR',
    }]);
  });

  it('keeps alerts at medium and drops rescinded or shapeless rows', () => {
    const alert = { ...order, attributes: { ...order.attributes, ORDER_ALERT_STATUS: 'Alert' } };
    const rescinded = { ...order, attributes: { ...order.attributes, ORDER_ALERT_STATUS: 'Rescinded' } };
    expect(parseBcEvacuations({ features: [alert, rescinded, { attributes: order.attributes }] }).map(e => e.severity)).toEqual(['medium']);
  });
});

describe('parseSaskAlert', () => {
  // Shaped from the SaskAlert public feed, 2026-10-12.
  const water = {
    id: 'urn:oid:2.49.0.1.124.1.2026', author_en: 'SK Macoun', event_en: 'Drinking Water', level: 'advisory', type_en: 'Updated',
    point: '49.25 -103.25', coverage_en: 'Village of Macoun', updated: '2026-10-12T14:22:01-06:00',
    html_link: 'https://emergencyalert.saskatchewan.ca/#/incidents/x',
  };

  it('falls back to the named areas when coverage is blank', () => {
    const [e] = parseSaskAlert({ entries: [{ ...water, coverage_en: '', area: [{ name_en: 'Village of Macoun' }, { name_en: 'R.M. of Cymri' }] }] });
    expect(e.title).toBe('Drinking Water advisory — Village of Macoun, R.M. of Cymri');
  });

  it('keeps provincial alerts and skips Environment Canada duplicates and cancellations', () => {
    const out = parseSaskAlert({ entries: [
      water,
      { ...water, id: 'ec', author_en: 'Environment Canada', event_en: 'snowfall' },
      { ...water, id: 'gone', type_en: 'Cancelled' },
    ] });
    expect(out).toEqual([expect.objectContaining({
      id: 'saskalert-urn:oid:2.49.0.1.124.1.2026',
      title: 'Drinking Water advisory — Village of Macoun',
      severity: 'medium',
      lat: 49.25,
      lng: -103.25,
      date: '2026-10-12T20:22:01.000Z',
      provider: 'SaskAlert',
    })]);
  });
});

describe('parseAeaAtom', () => {
  const feed = (entry: string) => `<?xml version='1.0'?><feed xmlns="http://www.w3.org/2005/Atom">${entry}</feed>`;

  it('places an entry by its GeoRSS polygon (lat lon pairs)', () => {
    const [e] = parseAeaAtom(feed(`<entry><id>aea-1</id><title>Wildfire - Evacuation Order</title><updated>2026-10-12T13:00:00-06:00</updated>
      <link href="https://www.alberta.ca/aea/1"/><cap:event>Wildfire</cap:event><cap:severity>Extreme</cap:severity>
      <georss:polygon>55 -115 55 -114 56 -114 56 -115 55 -115</georss:polygon></entry>`));
    expect(e).toMatchObject({ id: 'aea-aea-1', type: 'Wildfire', severity: 'high', lat: 55.5, lng: -114.5, source: 'https://www.alberta.ca/aea/1' });
  });

  it('is empty for a quiet feed and refuses a non-Atom body', () => {
    expect(parseAeaAtom(feed(''))).toEqual([]);
    expect(() => parseAeaAtom('<html></html>')).toThrow(/Atom/);
  });
});
