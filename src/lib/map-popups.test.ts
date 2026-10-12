import { describe, expect, it } from 'vitest';
import { radiationPopupHtml, urlSafe, weatherEventPopupHtml } from './map-popups';

describe('urlSafe', () => {
  it('escapes a link so a quote cannot leave the attribute', () => {
    expect(urlSafe('https://example.com/a"onmouseover="alert(1)')).toBe('https://example.com/a&quot;onmouseover=&quot;alert(1)');
    expect(urlSafe("https://example.com/?q='x'&y=<b>")).toBe('https://example.com/?q=&#39;x&#39;&amp;y=&lt;b&gt;');
  });

  it('refuses anything but http(s)', () => {
    expect(urlSafe('javascript:alert(1)')).toBe('#');
    expect(urlSafe('data:text/html,<script>')).toBe('#');
    expect(urlSafe(undefined)).toBe('#');
  });
});

describe('radiationPopupHtml', () => {
  const base = { name: 'RadNet Boston', city: 'Boston, MA', country: 'USA', reading: 70, network: 'EPA RadNet', time: '2026-10-12T19:25:00.000Z', baseline: 52, delta: 18 };

  it('explains a spike against the station\'s own week, with the reading time', () => {
    const html = radiationPopupHtml({ ...base, status: 'SPIKE' });
    expect(html).toContain('+18 over its 7-day mean of 52 nSv/h');
    expect(html).toContain('2026-10-12 19:25 UTC');
  });

  it('never calls an unrated or silent sensor normal', () => {
    expect(radiationPopupHtml({ ...base, status: 'UNRATED' })).toContain('No history to judge');
    expect(radiationPopupHtml({ ...base, status: 'OFFLINE' })).toContain('No reading for over 6 hours');
  });

  it('escapes crowd-sourced device names', () => {
    expect(radiationPopupHtml({ ...base, status: 'UNRATED', name: '<img src=x onerror=alert(1)>' })).not.toContain('<img');
  });
});

describe('weatherEventPopupHtml', () => {
  it('escapes issuer text and names the issuer and area', () => {
    const html = weatherEventPopupHtml({
      type: 'Strong Wind', title: '<img src=x onerror=alert(1)> Orange Alert', area: 'Solomon Islands waters', provider: 'WMO SWIC',
      severity: 'high', source: 'javascript:alert(1)',
    }, [160, -9]);
    expect(html).not.toContain('<img');
    expect(html).toContain('WMO SWIC');
    expect(html).toContain('Solomon Islands waters');
    expect(html).toContain('href="#"');
  });
});
