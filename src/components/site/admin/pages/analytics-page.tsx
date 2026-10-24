'use client';

import { useState, useSyncExternalStore } from 'react';
import { RotateCw } from 'lucide-react';
import { Button, PageTitle, Select } from '@/components/site/admin/parts/admin-parts';
import type {
  AnalyticsApi, AnalyticsAudience, AnalyticsData, AnalyticsEngagement, AnalyticsPages, AnalyticsStorage, AnalyticsSystem, AnalyticsVisitors,
} from '@/components/site/admin/analytics/analytics-types';
import { attention, flaggedTabs } from '@/components/site/admin/analytics/lib/attention';
import { useAnalyticsData } from '@/components/site/admin/analytics/lib/use-analytics-data';
import { viewerZone, zoneName } from '@/components/site/admin/analytics/lib/zone';
import { OverviewSection } from '@/components/site/admin/analytics/overview-section';
import { LiveSection } from '@/components/site/admin/analytics/live-section';
import { CrawlersSection } from '@/components/site/admin/analytics/crawlers-section';
import { SearchSection } from '@/components/site/admin/analytics/search-section';
import { AudienceSection } from '@/components/site/admin/analytics/audience-section';
import { VisitorsSection } from '@/components/site/admin/analytics/visitors-section';
import { EngagementSection } from '@/components/site/admin/analytics/engagement-section';
import { ApiSection } from '@/components/site/admin/analytics/api-section';
import { StorageSection } from '@/components/site/admin/analytics/storage-section';
import { IngestSection } from '@/components/site/admin/analytics/ingest-section';
import { SystemSection } from '@/components/site/admin/analytics/system-section';

/** Hours windows are exact on Overview, Audience and Visitors; the tabs kept by day (BY_DAY) show the last 7 days. */
const RANGES = [
  { id: '6h', label: 'Last 6 hours', unit: 'hours', n: 6 },
  { id: '24h', label: 'Last 24 hours', unit: 'hours', n: 24 },
  { id: '3d', label: 'Last 3 days', unit: 'hours', n: 72 },
  { id: '7d', label: 'Last 7 days', unit: 'days', n: 7 },
  { id: '30d', label: 'Last 30 days', unit: 'days', n: 30 },
  { id: '90d', label: 'Last 90 days', unit: 'days', n: 90 },
] as const;
type RangeId = (typeof RANGES)[number]['id'];
// Admins' own visits and accounts are left out everywhere but Live, where they show marked.
const ADMINS = 'admins=exclude';
const SECTIONS = [
  { id: 'overview', label: 'Overview' },
  { id: 'live', label: 'Live' },
  { id: 'audience', label: 'Audience' },
  { id: 'visitors', label: 'Visitors' },
  { id: 'search', label: 'Search' },
  { id: 'crawlers', label: 'Crawlers' },
  { id: 'engagement', label: 'Engagement' },
  { id: 'api', label: 'API' },
  { id: 'data', label: 'Data & storage' },
  { id: 'system', label: 'System' },
] as const;
type SectionId = (typeof SECTIONS)[number]['id'];
/** Tabs whose numbers are only kept by day: a window of hours shows them the last 7 days instead, and says so. */
const BY_DAY = new Set<SectionId>(['engagement', 'api', 'search', 'crawlers', 'data', 'system']);

const onHash = (notify: () => void) => {
  window.addEventListener('hashchange', notify);
  return () => window.removeEventListener('hashchange', notify);
};

/** The open section lives in the URL hash, so a link can point at it; #pages was its own tab before it joined Visitors. */
function useSection(): SectionId {
  const hash = useSyncExternalStore(onHash, () => window.location.hash.slice(1), () => '');
  return SECTIONS.find(s => s.id === (hash === 'pages' ? 'visitors' : hash))?.id ?? 'overview';
}

export default function AnalyticsPage() {
  const [span, setSpan] = useState<RangeId>('30d');
  const [rescans, setRescans] = useState(0);
  const [refreshes, setRefreshes] = useState(0);
  const section = useSection();
  const picked = RANGES.find(r => r.id === span)!;
  // The viewer's zone: Visitors counts its days from their midnight; the tables kept by UTC day ignore it.
  const tz = `tz=${encodeURIComponent(viewerZone())}`;
  // Refresh makes every address new, so each card and list on the tab asks again; the api drops n. Not ?refresh=1: that redoes the slow disk scans.
  const again = refreshes ? `&n=${refreshes}` : '';
  const range = `?${picked.unit}=${picked.n}&${ADMINS}&${tz}${again}`;
  const hours = picked.unit === 'hours' ? picked.n : null;
  const dayRange = hours ? `?days=7&${ADMINS}&${tz}${again}` : range;
  const byDay = BY_DAY.has(section);

  const audience = useAnalyticsData<AnalyticsAudience>(`/analytics/audience${range}`);
  const visitors = useAnalyticsData<AnalyticsVisitors>(`/analytics/visitors${range}`);
  const pages = useAnalyticsData<AnalyticsPages>(`/analytics/pages${range}`);
  const engagement = useAnalyticsData<AnalyticsEngagement>(`/analytics/engagement${dayRange}`);
  const api = useAnalyticsData<AnalyticsApi>(`/analytics/api${dayRange}`);
  const data = useAnalyticsData<AnalyticsData>(`/analytics/data${dayRange}`);
  const system = useAnalyticsData<AnalyticsSystem>(`/analytics/system${dayRange}`);
  // The api caches its disk scan; a rescan asks for a fresh one, and the counter makes each click a new request.
  const storage = useAnalyticsData<AnalyticsStorage>(`/analytics/storage${rescans ? `?refresh=1&n=${rescans}` : ''}`);
  const rescan = () => setRescans(n => n + 1);
  const notes = attention({
    audience: audience.data, visitors: visitors.data, pages: pages.data, api: api.data, data: data.data, system: system.data, storage: storage.data,
  });
  const flagged = flaggedTabs(notes);
  const loading = [audience, visitors, pages, engagement, api, data, system].some(q => q.stale);

  return (
    <>
      <PageTitle title="Analytics">
        <div className="flex items-center gap-2">
          <Select value={byDay && hours ? '7d' : span} onChange={e => setSpan(e.target.value as RangeId)} aria-label="Range">
            {RANGES.map(r => <option key={r.id} value={r.id} disabled={byDay && r.unit === 'hours'}>{r.label}</option>)}
          </Select>
          <Button aria-label="Refresh" title="Refresh" className="px-2" onClick={() => setRefreshes(n => n + 1)}>
            <RotateCw aria-hidden className={`size-4 ${loading ? 'animate-spin motion-reduce:animate-none' : ''}`} strokeWidth={1.75} />
          </Button>
        </div>
      </PageTitle>

      <div role="tablist" aria-label="Analytics sections" className="-mt-2 mb-5 flex gap-1 overflow-x-auto border-b border-line">
        {SECTIONS.map(s => (
          <button
            key={s.id}
            type="button"
            role="tab"
            aria-selected={section === s.id}
            onClick={() => { window.location.hash = s.id; }}
            className={`-mb-px h-9 whitespace-nowrap border-b-2 px-3 text-[13px] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent ${section === s.id ? 'border-accent text-ink-1' : 'border-transparent text-ink-3 hover:text-ink-1'}`}
          >
            {s.label}
            {s.id !== 'overview' && s.id !== 'live' && s.id !== 'search' && s.id !== 'crawlers' && flagged.has(s.id) && <span aria-label="needs a look" className="ml-1.5 inline-block size-1.5 rounded-full bg-amber align-middle" />}
          </button>
        ))}
      </div>

      <div role="tabpanel" aria-label={SECTIONS.find(s => s.id === section)?.label} className="flex flex-col gap-4 pb-10">
        {section !== 'live' && (
          <p className="text-[12px] text-ink-3">
            {section === 'visitors'
              ? `Times and days are in your time zone, ${zoneName()}, except where a card says it's kept by UTC day.`
              : `Times are in your time zone, ${zoneName()}. Days are UTC days, the way they're kept.`}
          </p>
        )}
        {byDay && hours && (
          <p className="text-[12px] text-ink-3">
            This tab is only kept by day, so it shows the last 7 days. Overview, Audience and Visitors go down to the hour.
          </p>
        )}
        {section === 'overview' && <OverviewSection attention={notes} hours={hours} audience={audience} visitors={visitors} pages={pages} engagement={engagement} api={api} storage={storage} system={system} />}
        {section === 'live' && <LiveSection hideAdmins={false} />}
        {section === 'audience' && <AudienceSection query={audience} hours={hours} />}
        {section === 'visitors' && <VisitorsSection pages={pages} visitors={visitors} range={range} hours={hours} />}
        {section === 'search' && <SearchSection range={dayRange} />}
        {section === 'crawlers' && <CrawlersSection range={dayRange} />}
        {section === 'engagement' && <EngagementSection query={engagement} />}
        {section === 'api' && <ApiSection query={api} />}
        {section === 'data' && (
          <>
            <StorageSection query={storage} onRescan={rescan} />
            <IngestSection query={data} />
          </>
        )}
        {section === 'system' && <SystemSection query={system} />}
      </div>
    </>
  );
}
