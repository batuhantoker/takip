import { describe, expect, it } from 'vitest';
import { indicatorColor, serviceStatusPopupHtml } from './service-status-popup';

describe('serviceStatusPopupHtml', () => {
  it('lists each vendor with its incidents, escaped', () => {
    const html = serviceStatusPopupHtml({
      city: 'San Francisco', worst: 'major',
      vendors: JSON.stringify([{
        name: 'Cloudflare', indicator: 'major', description: 'Partial System Outage', url: 'https://www.cloudflarestatus.com',
        incidents: [{ name: 'Errors <in> LAX', status: 'investigating', url: 'https://www.cloudflarestatus.com/incidents/x' }],
      }]),
    });
    expect(html).toContain('Service status');
    expect(html).toContain('San Francisco');
    expect(html).toContain('Errors &lt;in&gt; LAX');
    expect(html).toContain('href="https://www.cloudflarestatus.com/incidents/x"');
  });

  it('survives a malformed vendor list', () => {
    expect(serviceStatusPopupHtml({ city: 'X', worst: 'minor', vendors: '{' })).toContain('Service status');
  });

  it('colours by severity', () => {
    expect(indicatorColor('major')).toBe('#FF1744');
    expect(indicatorColor('minor')).toBe('#FF9500');
  });
});
