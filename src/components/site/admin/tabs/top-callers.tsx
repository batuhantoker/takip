'use client';

import { useState } from 'react';
import { useAdminData } from '@/components/site/admin/admin-api';
import { Card, ErrorText, Input, Label, Muted } from '@/components/site/admin/parts/admin-parts';
import type { UsageTop } from '@/components/site/admin/admin-types';
import UsageTopTable from '@/components/site/admin/tables/usage-top-table';

/** One UTC day's public API callers, busiest first: accounts, keys and anonymous address blocks. */
export function TopCallers() {
  const today = new Date().toISOString().slice(0, 10);
  const [day, setDay] = useState(today);
  const top = useAdminData<UsageTop>(`/usage/top?day=${day}`);

  return (
    <Card title={`Top callers on ${day}`}>
      <Label text="Day (UTC)">
        <Input type="date" value={day} max={today} onChange={e => e.target.value && setDay(e.target.value)} className="w-44" />
      </Label>
      <ErrorText message={top.error} />
      {top.data ? <UsageTopTable top={top.data} /> : !top.error && <Muted>Loading…</Muted>}
    </Card>
  );
}
