'use client';

import type { AnalyticsAudience } from '@/components/site/admin/analytics/analytics-types';
import { AudienceSection } from '@/components/site/admin/analytics/audience-section';
import { useAnalyticsData } from '@/components/site/admin/analytics/lib/use-analytics-data';
import { useRange, type Range } from '@/components/site/admin/analytics/lib/use-range';
import { RangeControls } from '@/components/site/admin/analytics/parts/range-controls';
import { AreaPage, useAreaTab } from '@/components/site/admin/parts/area-page';
import { AuditTab } from '@/components/site/admin/tabs/audit-tab';
import { PeopleTab } from '@/components/site/admin/tabs/people-tab';
import { ReportsTab } from '@/components/site/admin/tabs/reports-tab';

/** The accounts: each one, how they grow, what they reported, and every change made to them. */
export default function AccountsPage() {
  const tab = useAreaTab('accounts');
  const r = useRange();
  return (
    <AreaPage area="accounts" tab={tab}>
      {tab === 'people' && <PeopleTab />}
      {tab === 'growth' && <Growth r={r} />}
      {tab === 'reports' && <ReportsTab />}
      {tab === 'audit' && <AuditTab />}
    </AreaPage>
  );
}

function Growth({ r }: { r: Range }) {
  const query = useAnalyticsData<AnalyticsAudience>(`/analytics/audience${r.range}`);
  return (
    <div className="flex flex-col gap-4">
      <RangeControls r={r} loading={query.stale} />
      <AudienceSection query={query} hours={r.hours} />
    </div>
  );
}
