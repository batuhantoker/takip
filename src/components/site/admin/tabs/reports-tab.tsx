'use client';

import { useState } from 'react';
import { adminSend, useAdminData } from '@/components/site/admin/admin-api';
import { Button, ErrorText, Muted } from '@/components/site/admin/parts/admin-parts';
import ReportsTable from '@/components/site/admin/tables/reports-table';
import type { ReportList, ReportStatus } from '@/components/site/admin/admin-types';
import { useAdminAction } from '@/components/site/admin/use-admin-action';

const PAGE = 50;
const FILTERS: [ReportStatus | '', string][] = [['open', 'Open'], ['resolved', 'Resolved'], ['', 'All']];

export function ReportsTab() {
  const [status, setStatus] = useState<ReportStatus | ''>('open');
  const [offset, setOffset] = useState(0);
  const { data, error, reload } = useAdminData<ReportList>(`/reports?offset=${offset}&limit=${PAGE}${status ? `&status=${status}` : ''}`);
  const change = useAdminAction(reload);

  return (
    <>
      <div className="flex flex-wrap gap-1 mb-3">
        {FILTERS.map(([value, label]) => (
          <Button
            key={value}
            tone={status === value ? 'gold' : 'plain'}
            onClick={() => {
              setStatus(value);
              setOffset(0);
            }}
          >
            {label}{data ? ` (${data.counts[value || 'all']})` : ''}
          </Button>
        ))}
      </div>
      <ErrorText message={error ?? change.error} />
      {data && (
        <>
          <div className="overflow-x-auto border border-line bg-surface-1">
            <ReportsTable
              reports={data.reports}
              busy={change.busy}
              onStatus={(report, next) => void change.run(() => adminSend('PUT', `/reports/${report.id}/status`, { status: next }))}
            />
          </div>
          <div className="flex items-center gap-3 mt-3 text-[12px] text-ink-3">
            <span>{data.total ? `${offset + 1}–${offset + data.reports.length} of ${data.total}` : '0 reports'}</span>
            <Button disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE))}>Previous</Button>
            <Button disabled={offset + PAGE >= data.total} onClick={() => setOffset(offset + PAGE)}>Next</Button>
          </div>
        </>
      )}
      {!data && !error && <Muted>Loading…</Muted>}
    </>
  );
}
