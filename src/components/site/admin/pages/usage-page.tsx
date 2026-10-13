'use client';

import { useState } from 'react';
import { useAdminData } from '@/components/site/admin/admin-api';
import { Card, ErrorText, Input, Label, Muted, PageTitle, Select } from '@/components/site/admin/parts/admin-parts';
import type { UsageSeries, UsageTop } from '@/components/site/admin/admin-types';
import UsageDaysTable from '@/components/site/admin/tables/usage-days-table';
import UsageTopTable from '@/components/site/admin/tables/usage-top-table';

const RANGES = [7, 30, 90] as const;

export default function UsagePage() {
  const [range, setRange] = useState<number>(30);
  const [picked, setPicked] = useState<string | null>(null);
  const series = useAdminData<UsageSeries>(`/usage?days=${range}`);
  const day = picked ?? series.data?.today ?? '';
  const top = useAdminData<UsageTop>(`/usage/top${day ? `?day=${day}` : ''}`);

  return (
    <>
      <PageTitle title="Usage">
        <Select value={range} onChange={e => setRange(Number(e.target.value))} aria-label="Range">
          {RANGES.map(days => <option key={days} value={days}>Last {days} days</option>)}
        </Select>
      </PageTitle>
      <p className="-mt-3 mb-4 text-[12px] text-ink-3">Public API (/api/v1) requests by UTC day and route group. Refused means rate-limited or over quota.</p>

      <div className="flex flex-col gap-4">
        <Card title="Requests per day">
          <ErrorText message={series.error} />
          {series.data ? (
            series.data.groups.length ? <UsageDaysTable series={series.data} selected={day} onSelect={setPicked} /> : <Muted>No requests in this range.</Muted>
          ) : (
            !series.error && <Muted>Loading…</Muted>
          )}
        </Card>

        <Card title={`Top callers on ${day || '…'}`}>
          <Label text="Day (UTC)">
            <Input type="date" value={day} max={series.data?.today} onChange={e => e.target.value && setPicked(e.target.value)} className="w-44" />
          </Label>
          <ErrorText message={top.error} />
          {top.data ? <UsageTopTable top={top.data} /> : !top.error && <Muted>Loading…</Muted>}
        </Card>
      </div>
    </>
  );
}
