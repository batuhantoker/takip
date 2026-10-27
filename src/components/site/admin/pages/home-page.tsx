'use client';

import Link from 'next/link';
import { useAdminData } from '@/components/site/admin/admin-api';
import type { Overview } from '@/components/site/admin/admin-types';
import type {
  AnalyticsApi, AnalyticsAudience, AnalyticsData, AnalyticsEngagement, AnalyticsLive, AnalyticsPages, AnalyticsStorage, AnalyticsSystem,
  AnalyticsVisitors,
} from '@/components/site/admin/analytics/analytics-types';
import { attention } from '@/components/site/admin/analytics/lib/attention';
import { useAnalyticsData } from '@/components/site/admin/analytics/lib/use-analytics-data';
import { useRange } from '@/components/site/admin/analytics/lib/use-range';
import { OverviewSection } from '@/components/site/admin/analytics/overview-section';
import { RangeControls } from '@/components/site/admin/analytics/parts/range-controls';
import { tabHref } from '@/components/site/admin/lib/areas';
import { Card, ErrorText, Muted } from '@/components/site/admin/parts/admin-parts';
import { AreaPage } from '@/components/site/admin/parts/area-page';
import AuditTable from '@/components/site/admin/tables/audit-table';

/** The console's first page: what needs a look, today in numbers, the top lists, and the latest changes. */
export default function HomePage() {
  const r = useRange();
  const audience = useAnalyticsData<AnalyticsAudience>(`/analytics/audience${r.range}`);
  const visitors = useAnalyticsData<AnalyticsVisitors>(`/analytics/visitors${r.range}`);
  const pages = useAnalyticsData<AnalyticsPages>(`/analytics/pages${r.range}`);
  const engagement = useAnalyticsData<AnalyticsEngagement>(`/analytics/engagement${r.dayRange}`);
  const api = useAnalyticsData<AnalyticsApi>(`/analytics/api${r.dayRange}`);
  const data = useAnalyticsData<AnalyticsData>(`/analytics/data${r.dayRange}`);
  const system = useAnalyticsData<AnalyticsSystem>(`/analytics/system${r.dayRange}`);
  const storage = useAnalyticsData<AnalyticsStorage>('/analytics/storage');
  const live = useAnalyticsData<AnalyticsLive>(`/analytics/live?admins=exclude&n=${r.refreshes}`);
  const overview = useAdminData<Overview>('/overview');
  const notes = attention({
    audience: audience.data, visitors: visitors.data, pages: pages.data, api: api.data, data: data.data, system: system.data, storage: storage.data,
  });
  const loading = [audience, visitors, pages, engagement, api, data, system, live].some(q => q.stale);

  return (
    <AreaPage area="home">
      <div className="flex flex-col gap-4">
        <RangeControls r={r} loading={loading} />
        <OverviewSection attention={notes} hours={r.hours} audience={audience} visitors={visitors} pages={pages} engagement={engagement}
          api={api} storage={storage} system={system} live={live} />
        <Card title="Recent changes">
          <ErrorText message={overview.error} />
          {overview.data ? <AuditTable events={overview.data.recent} /> : !overview.error && <Muted>Loading…</Muted>}
          <Link href={tabHref('accounts', 'audit')} className="self-start text-[12px] text-accent hover:underline">Full audit log</Link>
        </Card>
      </div>
    </AreaPage>
  );
}
