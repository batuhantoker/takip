'use client';

import { useState } from 'react';
import type { AnalyticsData, AnalyticsStorage, AnalyticsSystem } from '@/components/site/admin/analytics/analytics-types';
import { IngestSection } from '@/components/site/admin/analytics/ingest-section';
import { useAnalyticsData } from '@/components/site/admin/analytics/lib/use-analytics-data';
import { useRange, type Range } from '@/components/site/admin/analytics/lib/use-range';
import { RangeControls } from '@/components/site/admin/analytics/parts/range-controls';
import { StorageSection } from '@/components/site/admin/analytics/storage-section';
import { SystemSection } from '@/components/site/admin/analytics/system-section';
import { AreaPage, useAreaTab } from '@/components/site/admin/parts/area-page';
import { SourcesTab } from '@/components/site/admin/tabs/sources-tab';

/** The feeds: which are recorded, what they and the archive take up, and the api running it all. */
export default function DataPage() {
  const tab = useAreaTab('data');
  const r = useRange();
  return (
    <AreaPage area="data" tab={tab}>
      {tab === 'sources' && <SourcesTab />}
      {tab === 'storage' && <Storage r={r} />}
      {tab === 'system' && <System r={r} />}
    </AreaPage>
  );
}

function Storage({ r }: { r: Range }) {
  const [rescans, setRescans] = useState(0);
  const data = useAnalyticsData<AnalyticsData>(`/analytics/data${r.dayRange}`);
  // The api caches its disk scan; a rescan asks for a fresh one, and the counter makes each click a new request.
  const storage = useAnalyticsData<AnalyticsStorage>(`/analytics/storage${rescans ? `?refresh=1&n=${rescans}` : ''}`);
  return (
    <div className="flex flex-col gap-4">
      <RangeControls r={r} byDay loading={data.stale} />
      <StorageSection query={storage} onRescan={() => setRescans(n => n + 1)} />
      <IngestSection query={data} />
    </div>
  );
}

function System({ r }: { r: Range }) {
  const query = useAnalyticsData<AnalyticsSystem>(`/analytics/system${r.dayRange}`);
  return (
    <div className="flex flex-col gap-4">
      <RangeControls r={r} byDay loading={query.stale} />
      <SystemSection query={query} />
    </div>
  );
}
