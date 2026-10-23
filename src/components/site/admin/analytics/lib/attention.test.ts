import { describe, expect, it } from 'vitest';
import type { AnalyticsApi, AnalyticsPages, AnalyticsStorage, AnalyticsSystem } from '../analytics-types';
import { attention, flaggedTabs } from './attention';

const NOW = Date.parse('2026-10-19T15:00:00Z');

const system = (over: Partial<AnalyticsSystem> = {}): AnalyticsSystem => ({
  now: NOW, startedAt: NOW - 60_000, node: 'v24', platform: 'linux x64',
  memory: { rss: 1, heapUsed: 1, heapTotal: 1, external: 0 },
  host: { cpus: 8, load: [0.5, 0.5, 0.5], totalMemory: 8e9, freeMemory: 5e9 },
  eventLoopLagMs: 10,
  http: [{ group: 'v1', requests: 16, errors: 0, p50Ms: 10, p95Ms: 600 }],
  jobs: [{ kind: 'db.backup', pending: 1, failed: 0, done: 8, lastDoneAt: NOW - 3_600_000, lastError: null }],
  backups: { count: 8, bytes: 1, latest: { name: 'app.db', bytes: 1, at: NOW - 3_600_000 } },
  reports: { open: 0, resolved: 0, days: [] },
  audit: { days: [], actions: [] },
  workspaces: { total: 0, createdInRange: 0 },
  ...over,
} as AnalyticsSystem);

describe('attention', () => {
  it('stays quiet when nothing is wrong', () => {
    expect(attention({ system: system() }, NOW)).toEqual([]);
  });

  it('puts problems before things to watch and news, each pointing at its tab', () => {
    const items = attention({
      system: system({
        jobs: [{ kind: 'email.send', pending: 0, failed: 2, done: 1, lastDoneAt: null, lastError: 'SMTP refused' }],
        reports: { open: 1, resolved: 0, days: [] },
      }),
      pages: { today: '2026-10-19', since: '2026-10-19', totals: { views: 3, readers: 2, pages: 1, toMap: 1 }, daily: [],
        pages: [{ path: '/tr/city/nevsehir/cameras', views: 3, readers: 2, toMap: 1 }], sections: [], locales: [],
        referrers: [{ referrer: 'www.google.com', views: 2, readers: 2 }],
        journeys: {
          since: null,
          totals: {
            visitors: 0, new: 0, readers: 0, mapUsers: 0, both: 0, signedIn: 0, minutes: 0, pageMapMinutes: 0, pageMapUsers: 0,
            visits: 0, views: 0, left: 0, readOn: 0, toMap: 0, landedOnMap: 0, returning: 0, avgSteps: 0, medianMs: null,
          },
          series: [], flow: [], channels: [], sources: [{ source: 'Google', channel: 'search', hosts: ['www.google.com'], visits: 2 }], links: [], steps: [], pages: [], hours: [], countries: [], cities: [], points: [], devices: [], browsers: [], oses: [], campaigns: [], automated: 0,
        } } as AnalyticsPages,
    }, NOW);
    expect(items.map(i => [i.tone, i.tab, i.text])).toEqual([
      ['problem', 'system', '2 background jobs failed (email.send): SMTP refused'],
      ['watch', 'system', '1 issue report waiting'],
      ['news', 'visitors', '2 page views from search engines in the range'],
      ['news', 'visitors', 'Most read: /tr/city/nevsehir/cameras (3 views)'],
      ['news', 'visitors', 'Most visits from another site came from Google (2 visits)'],
    ]);
    expect([...flaggedTabs(items)]).toEqual(['system']);
  });

  it('flags a missed backup and a nearly full disk', () => {
    const items = attention({
      system: system({ backups: { count: 3, bytes: 1, latest: { name: 'app.db', bytes: 1, at: NOW - 3 * 86_400_000 } } }),
      storage: { disk: { total: 100e9, free: 5e9, used: 95e9 } } as AnalyticsStorage,
    }, NOW);
    expect(items.map(i => i.text)).toEqual(['Last database backup was 3 days ago', 'Disk nearly full: 4.7 GB free (5%)']);
  });

  it('only calls refusals out when they are a real share of the day', () => {
    const day = (requests: number, denied: number) => ({ days: [{ day: '2026-10-19', requests, denied, bytes: 0, callers: 1, keys: 1 }] }) as AnalyticsApi;
    expect(attention({ api: day(900, 52) }, NOW)).toEqual([]);
    expect(attention({ api: day(100, 5) }, NOW)).toEqual([]);
    expect(attention({ api: day(100, 40) }, NOW).map(i => i.text)).toEqual(["29% of today's API requests were refused (40 requests)"]);
  });
});
