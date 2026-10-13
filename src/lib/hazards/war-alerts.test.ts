import { describe, expect, it } from 'vitest';
import { warAlertFeatures, warAlertPopupHtml, type WarAlertRow } from './war-alerts';

const KYIV: WarAlertRow = {
  id: 'ua-kyiv', country: 'UA', place: 'Kyiv', lat: 50.4501, lng: 30.5234, precision: 'oblast',
  threat: 'air-raid', label: 'Air-raid alert', active: true, since: '2026-10-12T19:09:52.000Z',
  provider: 'ubilling.net.ua', source: 'https://map.ukrainealarm.com/',
};

describe('warAlertFeatures', () => {
  it('places each alert as a point with its threat colour', () => {
    const [f] = warAlertFeatures([KYIV, { ...KYIV, id: 'bad', lat: NaN }]);
    expect(f.geometry.coordinates).toEqual([30.5234, 50.4501]);
    expect(f.properties).toMatchObject({ id: 'ua-kyiv', color: '#FF3D3D', active: true });
  });
});

describe('warAlertPopupHtml', () => {
  it('says an oblast pin is an anchor, not the target', () => {
    expect(warAlertPopupHtml({ ...KYIV })).toContain('the pin is its administrative centre');
  });

  it('marks ended sirens and escapes place names', () => {
    const html = warAlertPopupHtml({ ...KYIV, country: 'IL', precision: 'locality', active: false, place: '<b>x</b>', count: 3 });
    expect(html).toContain('Ended');
    expect(html).toContain('Sirens, last 24 h');
    expect(html).not.toContain('<b>x</b>');
  });
});
