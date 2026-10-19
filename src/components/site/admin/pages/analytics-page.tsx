'use client';

import { useState, useSyncExternalStore } from 'react';
import { PageTitle, Select } from '@/components/site/admin/parts/admin-parts';
import { Switch } from '@/components/site/admin/parts/admin-switch';
import type {
  AnalyticsApi, AnalyticsAudience, AnalyticsData, AnalyticsEngagement, AnalyticsPages, AnalyticsStorage, AnalyticsSystem, AnalyticsVisitors,
} from '@/components/site/admin/analytics/analytics-types';
import { attention, flaggedTabs } from '@/components/site/admin/analytics/lib/attention';
import { useAnalyticsData } from '@/components/site/admin/analytics/lib/use-analytics-data';
import { OverviewSection } from '@/components/site/admin/analytics/overview-section';
import { AudienceSection } from '@/components/site/admin/analytics/audience-section';
import { VisitorsSection } from '@/components/site/admin/analytics/visitors-section';
import { PagesSection } from '@/components/site/admin/analytics/pages-section';
import { EngagementSection } from '@/components/site/admin/analytics/engagement-section';
import { ApiSection } from '@/components/site/admin/analytics/api-section';
import { StorageSection } from '@/components/site/admin/analytics/storage-section';
import { IngestSection } from '@/components/site/admin/analytics/ingest-section';
import { SystemSection } from '@/components/site/admin/analytics/system-section';

const RANGES = [7, 30, 90] as const;
const SECTIONS = [
  { id: 'overview', label: 'Overview' },
  { id: 'audience', label: 'Audience' },
  { id: 'visitors', label: 'Visitors' },
  { id: 'pages', label: 'Pages' },
  { id: 'engagement', label: 'Engagement' },
  { id: 'api', label: 'API' },
  { id: 'data', label: 'Data & storage' },
  { id: 'system', label: 'System' },
] as const;
type SectionId = (typeof SECTIONS)[number]['id'];

const onHash = (notify: () => void) => {
  window.addEventListener('hashchange', notify);
  return () => window.removeEventListener('hashchange', notify);
};

/** The open section lives in the URL hash, so a link can point at it. */
function useSection(): SectionId {
  const hash = useSyncExternalStore(onHash, () => window.location.hash.slice(1), () => '');
  return SECTIONS.find(s => s.id === hash)?.id ?? 'overview';
}

export default function AnalyticsPage() {
  const [days, setDays] = useState<number>(30);
  const [hideAdmins, setHideAdmins] = useState(false);
  const [rescans, setRescans] = useState(0);
  const section = useSection();
  const range = `?days=${days}${hideAdmins ? '&admins=exclude' : ''}`;

  const audience = useAnalyticsData<AnalyticsAudience>(`/analytics/audience${range}`);
  const visitors = useAnalyticsData<AnalyticsVisitors>(`/analytics/visitors${range}`);
  const pages = useAnalyticsData<AnalyticsPages>(`/analytics/pages${range}`);
  const engagement = useAnalyticsData<AnalyticsEngagement>(`/analytics/engagement${range}`);
  const api = useAnalyticsData<AnalyticsApi>(`/analytics/api${range}`);
  const data = useAnalyticsData<AnalyticsData>(`/analytics/data${range}`);
  const system = useAnalyticsData<AnalyticsSystem>(`/analytics/system${range}`);
  // The api caches its disk scan; a rescan asks for a fresh one, and the counter makes each click a new request.
  const storage = useAnalyticsData<AnalyticsStorage>(`/analytics/storage${rescans ? `?refresh=1&n=${rescans}` : ''}`);
  const rescan = () => setRescans(n => n + 1);
  const notes = attention({
    audience: audience.data, visitors: visitors.data, pages: pages.data, api: api.data, data: data.data, system: system.data, storage: storage.data,
  });
  const flagged = flaggedTabs(notes);

  return (
    <>
      <PageTitle title="Analytics">
        <div className="flex flex-wrap items-center justify-end gap-3">
          <Switch on={hideAdmins} states={['Admins hidden', 'Admins included']} label="Hide admin accounts" disabled={false} warnOff={false} onClick={() => setHideAdmins(v => !v)} />
          <Select value={days} onChange={e => setDays(Number(e.target.value))} aria-label="Range">
            {RANGES.map(n => <option key={n} value={n}>Last {n} days</option>)}
          </Select>
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
            {s.id !== 'overview' && flagged.has(s.id) && <span aria-label="needs a look" className="ml-1.5 inline-block size-1.5 rounded-full bg-amber align-middle" />}
          </button>
        ))}
      </div>

      <div role="tabpanel" aria-label={SECTIONS.find(s => s.id === section)?.label} className="flex flex-col gap-4 pb-10">
        {section === 'overview' && <OverviewSection attention={notes} audience={audience} visitors={visitors} pages={pages} engagement={engagement} api={api} storage={storage} system={system} />}
        {section === 'audience' && <AudienceSection query={audience} />}
        {section === 'visitors' && <VisitorsSection query={visitors} days={days} />}
        {section === 'pages' && <PagesSection query={pages} />}
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
