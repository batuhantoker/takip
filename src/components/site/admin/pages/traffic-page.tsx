'use client';

import type { AnalyticsEngagement, AnalyticsPages, AnalyticsVisitors } from '@/components/site/admin/analytics/analytics-types';
import { CrawlersSection } from '@/components/site/admin/analytics/crawlers-section';
import { EngagementSection } from '@/components/site/admin/analytics/engagement-section';
import { useAnalyticsData } from '@/components/site/admin/analytics/lib/use-analytics-data';
import { useRange, type Range } from '@/components/site/admin/analytics/lib/use-range';
import { LiveSection } from '@/components/site/admin/analytics/live-section';
import { RangeControls } from '@/components/site/admin/analytics/parts/range-controls';
import { SearchSection } from '@/components/site/admin/analytics/search-section';
import { VisitorsSection } from '@/components/site/admin/analytics/visitors-section';
import { AreaPage, useAreaTab } from '@/components/site/admin/parts/area-page';

/** Who comes and what they do: live, the visit log, map engagement, Google Search and crawlers. */
export default function TrafficPage() {
  const tab = useAreaTab('traffic');
  const r = useRange();
  return (
    <AreaPage area="traffic" tab={tab}>
      <div className="flex flex-col gap-4">
        {tab === 'live' && <LiveSection hideAdmins={false} />}
        {tab === 'visitors' && <Visitors r={r} />}
        {tab === 'engagement' && <Engagement r={r} />}
        {tab === 'search' && <><RangeControls r={r} byDay loading={false} /><SearchSection range={r.dayRange} /></>}
        {tab === 'crawlers' && <><RangeControls r={r} byDay loading={false} /><CrawlersSection range={r.dayRange} /></>}
      </div>
    </AreaPage>
  );
}

function Visitors({ r }: { r: Range }) {
  const pages = useAnalyticsData<AnalyticsPages>(`/analytics/pages${r.range}`);
  const visitors = useAnalyticsData<AnalyticsVisitors>(`/analytics/visitors${r.range}`);
  return (
    <>
      <RangeControls r={r} local loading={pages.stale || visitors.stale} />
      <VisitorsSection pages={pages} visitors={visitors} range={r.range} hours={r.hours} />
    </>
  );
}

function Engagement({ r }: { r: Range }) {
  const query = useAnalyticsData<AnalyticsEngagement>(`/analytics/engagement${r.dayRange}`);
  return (
    <>
      <RangeControls r={r} byDay loading={query.stale} />
      <EngagementSection query={query} />
    </>
  );
}
