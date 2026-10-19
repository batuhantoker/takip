import type {
  AnalyticsApi, AnalyticsAudience, AnalyticsData, AnalyticsPages, AnalyticsStorage, AnalyticsSystem, AnalyticsVisitors,
} from '../analytics-types';
import { bytes, pct, plural, sum } from './format';

/**
 * What the Overview leads with: problems first, then things worth knowing, each pointing at the tab with the detail.
 * Only what fires is listed, so a quiet day is one line and nothing is missed on a busy one.
 */

export type AttentionTab = 'audience' | 'visitors' | 'pages' | 'engagement' | 'api' | 'data' | 'system';
export type AttentionTone = 'problem' | 'watch' | 'news';
export interface Attention { id: string; tone: AttentionTone; tab: AttentionTab; text: string }

export interface AttentionInput {
  audience?: AnalyticsAudience;
  visitors?: AnalyticsVisitors;
  pages?: AnalyticsPages;
  api?: AnalyticsApi;
  data?: AnalyticsData;
  system?: AnalyticsSystem;
  storage?: AnalyticsStorage;
}

const HOUR = 3_600_000;
/** The api writes a backup each day; older than this means a run was missed. */
const BACKUP_STALE_MS = 36 * HOUR;
const DISK_LOW = 0.1;
/** The api's own memory; the host's free figure leaves out page cache, so it reads nearly full after any build. */
const API_RSS_HIGH = 1024 ** 3;
const LAG_HIGH_MS = 200;
/** Refusals worth a look: this share of a day's requests, and at least this many. */
const REFUSED_SHARE = 0.1;
const REFUSED_MIN = 20;
const SEARCH = /(^|\.)(google|bing|yandex|duckduckgo|baidu|naver|yahoo|ecosia|qwant|seznam)\./i;

const ORDER: Record<AttentionTone, number> = { problem: 0, watch: 1, news: 2 };

const age = (ms: number) => (ms < 48 * HOUR ? `${Math.round(ms / HOUR)} h` : `${Math.round(ms / (24 * HOUR))} days`);

export function attention({ audience, visitors, pages, api, data, system, storage }: AttentionInput, now = Date.now()): Attention[] {
  const out: Attention[] = [];
  const add = (id: string, tone: AttentionTone, tab: AttentionTab, text: string) => out.push({ id, tone, tab, text });

  if (system) {
    const failed = system.jobs.filter(j => j.failed > 0);
    if (failed.length) {
      const last = failed.find(j => j.lastError)?.lastError;
      add('jobs', 'problem', 'system', `${plural(sum(failed.map(j => j.failed)), 'background job')} failed (${failed.map(j => j.kind).join(', ')})${last ? `: ${last}` : ''}`);
    }
    const errors = system.http.filter(g => g.errors > 0);
    if (errors.length) add('http', 'problem', 'system', `${plural(sum(errors.map(g => g.errors)), 'server error')} since the api started, in ${errors.map(g => g.group).join(', ')}`);
    if (!system.backups?.latest) add('backup', 'problem', 'system', 'No database backup on record');
    else if (now - system.backups.latest.at > BACKUP_STALE_MS) add('backup', 'problem', 'system', `Last database backup was ${age(now - system.backups.latest.at)} ago`);
    if (system.memory.rss > API_RSS_HIGH) add('memory', 'watch', 'system', `The api is using ${bytes(system.memory.rss)} of memory`);
    if (system.eventLoopLagMs != null && system.eventLoopLagMs > LAG_HIGH_MS) add('lag', 'watch', 'system', `The api is slow to respond: event-loop lag ${Math.round(system.eventLoopLagMs)} ms`);
    if (system.reports.open) add('reports', 'watch', 'system', `${plural(system.reports.open, 'issue report')} waiting`);
  }

  if (storage?.disk && storage.disk.free / storage.disk.total < DISK_LOW) {
    add('disk', 'problem', 'data', `Disk nearly full: ${bytes(storage.disk.free)} free (${pct(storage.disk.free, storage.disk.total)})`);
  }

  if (data?.available) {
    const failing = data.sources.filter(s => s.lastStatus && s.lastStatus !== 'ok' && s.lastError);
    if (failing.length) add('ingest', 'problem', 'data', `${plural(failing.length, 'feed')} failing on the last run: ${failing.map(s => s.name).join(', ')}`);
    else {
      const failedRuns = sum(data.days.map(d => d.failed));
      if (failedRuns) add('ingest-runs', 'watch', 'data', `${plural(failedRuns, 'ingest run')} failed in the range, none failing now`);
    }
  }

  const today = api?.days[api.days.length - 1];
  if (today && today.denied >= REFUSED_MIN && today.denied / Math.max(1, today.requests + today.denied) >= REFUSED_SHARE) {
    add('refused', 'watch', 'api', `${pct(today.denied, today.requests + today.denied)} of today's API requests were refused (${plural(today.denied, 'request')})`);
  }

  if (visitors?.totals.hitWall) add('wall', 'watch', 'visitors', `${plural(visitors.totals.hitWall, 'visitor')} used up the daily map time`);

  const signups = audience?.days[audience.days.length - 1]?.signups ?? 0;
  if (signups) add('signups', 'news', 'audience', `${plural(signups, 'new account')} today`);

  const search = sum((pages?.referrers ?? []).filter(r => r.referrer && SEARCH.test(r.referrer)).map(r => r.views));
  if (search) add('search', 'news', 'pages', `${plural(search, 'page view')} from search engines in the range`);

  const topPage = pages?.pages[0];
  if (topPage) add('top-page', 'news', 'pages', `Most read: ${topPage.path} (${plural(topPage.views, 'view')})`);

  const referrer = visitors?.referrers.find(r => r.referrer);
  if (referrer) add('referrer', 'news', 'visitors', `Most visitors arrived from ${referrer.referrer} (${plural(referrer.visitors, 'visitor')})`);

  return out.sort((a, b) => ORDER[a.tone] - ORDER[b.tone]);
}

/** Tabs with a problem or something to watch, for the dots on the tab bar. */
export const flaggedTabs = (items: Attention[]) => new Set(items.filter(i => i.tone !== 'news').map(i => i.tab));
