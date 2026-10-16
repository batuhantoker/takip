import { describe, expect, it } from 'vitest';
import { VENDORS, degradedByCity, mapSummary } from './statuspage';

const cloudflare = VENDORS.find(v => v.id === 'cloudflare')!;
const github = VENDORS.find(v => v.id === 'github')!;

// Trimmed from www.cloudflarestatus.com/api/v2/summary.json, 2026-10-12.
const CF = {
  page: { id: 'yh6f0r4529hb', name: 'Cloudflare Status', url: 'https://www.cloudflarestatus.com' },
  status: { indicator: 'major', description: 'Partial System Outage' },
  incidents: [{
    id: 'mbv1dfp471bh', name: 'Cloudflare Workers - Cron Trigger Activation Issues', status: 'monitoring', impact: 'minor',
    shortlink: 'https://www.cloudflarestatus.com/incidents/mbv1dfp471bh', started_at: '2026-10-12T19:09:20.000Z',
    incident_updates: [{ status: 'monitoring', body: 'A fix has been implemented and we are monitoring the results.' }],
  }],
  scheduled_maintenances: [{ status: 'scheduled' }],
};
const QUIET = { page: { url: 'https://www.githubstatus.com' }, status: { indicator: 'none', description: 'All Systems Operational' }, incidents: [] };

describe('mapSummary', () => {
  it('keeps the indicator and the unresolved incidents', () => {
    expect(mapSummary(cloudflare, CF)).toEqual({
      id: 'cloudflare', name: 'Cloudflare', city: 'San Francisco', lat: 37.7749, lng: -122.4194,
      indicator: 'major', description: 'Partial System Outage',
      incidents: [{
        name: 'Cloudflare Workers - Cron Trigger Activation Issues', status: 'monitoring', impact: 'minor',
        url: 'https://www.cloudflarestatus.com/incidents/mbv1dfp471bh', started_at: '2026-10-12T19:09:20.000Z',
        update: 'A fix has been implemented and we are monitoring the results.',
      }],
      url: 'https://www.cloudflarestatus.com',
    });
  });

  it('reads an unknown indicator as minor, and refuses a page that is not a summary', () => {
    expect(mapSummary(github, { status: { indicator: 'degraded' } }).indicator).toBe('minor');
    expect(() => mapSummary(github, { error: 'x' })).toThrow();
  });
});

describe('degradedByCity', () => {
  it('pins only vendors with something to report, worst first per city', () => {
    const cities = degradedByCity([mapSummary(github, QUIET), mapSummary(cloudflare, CF), mapSummary(github, { ...QUIET, status: { indicator: 'minor' } })]);
    expect(cities).toHaveLength(1);
    expect(cities[0]).toMatchObject({ city: 'San Francisco', worst: 'major' });
    expect(cities[0].vendors.map(v => v.id)).toEqual(['cloudflare', 'github']);
  });
});
