'use client';

import type { AnalyticsApi } from '@/components/site/admin/analytics/analytics-types';
import { ApiSection } from '@/components/site/admin/analytics/api-section';
import { useAnalyticsData } from '@/components/site/admin/analytics/lib/use-analytics-data';
import { useRange, type Range } from '@/components/site/admin/analytics/lib/use-range';
import { RangeControls } from '@/components/site/admin/analytics/parts/range-controls';
import { AreaPage, useAreaTab } from '@/components/site/admin/parts/area-page';
import { AccessTab } from '@/components/site/admin/tabs/access-tab';
import { KeysTab } from '@/components/site/admin/tabs/keys-tab';
import { TopCallers } from '@/components/site/admin/tabs/top-callers';

/** The public API: its traffic and callers, the keys, and which routes need one. */
export default function ApiPage() {
  const tab = useAreaTab('api');
  const r = useRange();
  return (
    <AreaPage area="api" tab={tab}>
      {tab === 'traffic' && <Traffic r={r} />}
      {tab === 'keys' && <KeysTab />}
      {tab === 'access' && <AccessTab />}
    </AreaPage>
  );
}

function Traffic({ r }: { r: Range }) {
  const query = useAnalyticsData<AnalyticsApi>(`/analytics/api${r.dayRange}`);
  return (
    <div className="flex flex-col gap-4">
      <RangeControls r={r} byDay loading={query.stale} />
      <ApiSection query={query} />
      <TopCallers />
    </div>
  );
}
