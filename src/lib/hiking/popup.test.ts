import { describe, expect, it } from 'vitest';
import type { RouteSummary } from './api';
import { hikingPopupHtml } from './popup';

const routes: RouteSummary[] = [
  { id: 19687570, group: 'AL2', itinerary: ['Arvengarten', 'Männlichen'], symbol_id: 'osmc_LOC_white_red-bar' },
  { id: 19582477, group: 'AL1', name: '<img src=x onerror=alert(1)>', symbol_id: 'bad"id' },
];

describe('hikingPopupHtml', () => {
  it('describes the selected route and lists the others as buttons', () => {
    const html = hikingPopupHtml(routes, 19687570, 'loading');
    expect(html).toContain('Arvengarten – Männlichen');
    expect(html).toContain('MOUNTAIN TRAIL');
    expect(html).toContain('LOADING DETAILS');
    expect(html).toContain('data-hiking-route="19582477"');
    expect(html).toContain('https://www.openstreetmap.org/relation/19687570');
    expect(html).not.toContain('data-hiking-fit');
  });

  it('escapes route names and symbol ids from the API', () => {
    const html = hikingPopupHtml(routes, 19582477, undefined);
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;img src=x');
    expect(html).toContain('/symbols/id/badid.svg');
  });

  it('adds lengths, links and the fit button once details land', () => {
    const html = hikingPopupHtml(routes, 19687570, {
      id: 19687570, length: 3431, official_length: 3500, url: 'javascript:alert(1)',
      wikipedia: 'https://en.wikipedia.org/wiki/Männlichen', bbox: [7.95, 46.6, 7.98, 46.62], superroutes: [], subroutes: 0,
    });
    expect(html).toContain('3.4 km');
    expect(html).toContain('3.5 km');
    expect(html).toContain('data-hiking-fit');
    expect(html).toContain('WIKIPEDIA');
    expect(html).not.toContain('javascript:');
  });
});
