'use client';

import { useState, type FormEvent } from 'react';
import { useAdminData } from '@/components/site/admin/admin-api';
import { Button, ErrorText, Input, Muted } from '@/components/site/admin/parts/admin-parts';
import VisitorsTable from '@/components/site/admin/tables/visitors-table';
import type { VisitorList, VisitorSort } from '../analytics-types';
import { count } from '../lib/format';
import { DbIpCredit } from './place-label';

const PAGE = 50;

/** The visitors table with its own sort, search and paging; a new range goes back to the first page. */
export default function VisitorsList({ days }: { days: number }) {
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<VisitorSort>('lastSeen');
  const [offset, setOffset] = useState(0);
  const [rangeShown, setRangeShown] = useState(days);
  if (rangeShown !== days) {
    setRangeShown(days);
    setOffset(0);
  }
  const { data, error } = useAdminData<VisitorList>(`/analytics/visitors/list?days=${days}&sort=${sort}&q=${encodeURIComponent(q)}&offset=${offset}&limit=${PAGE}`);

  const search = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setQ(String(new FormData(e.currentTarget).get('q')).trim());
    setOffset(0);
  };
  const sortBy = (next: VisitorSort) => {
    setSort(next);
    setOffset(0);
  };

  return (
    <section className="flex flex-col gap-3 rounded-card border border-line bg-surface-1 p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-[12px] font-medium text-ink-2">Every visitor</h2>
          <p className="mt-0.5 text-[11px] text-ink-3">Seen in the last {data?.days ?? days} days, with their signed-out time. Open one for everything it did.</p>
        </div>
        <form onSubmit={search} className="flex gap-2">
          <Input name="q" placeholder="Visitor id or account email" defaultValue={q} className="w-64" aria-label="Search visitors" />
          <Button type="submit">Search</Button>
        </form>
      </div>
      <ErrorText message={error} />
      {data && (
        <>
          <div className="overflow-x-auto">
            <VisitorsTable list={data} onSort={sortBy} />
            {!data.visitors.length && <div className="pt-3"><Muted>{q ? 'No visitors match.' : 'No visitors in this range yet.'}</Muted></div>}
          </div>
          <div className="flex items-center gap-3 text-[12px] text-ink-3">
            <span>{data.total ? `${offset + 1}–${offset + data.visitors.length} of ${count(data.total)}` : '0 visitors'}</span>
            <Button disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE))}>Previous</Button>
            <Button disabled={offset + PAGE >= data.total} onClick={() => setOffset(offset + PAGE)}>Next</Button>
          </div>
          {data.visitors.some(v => v.place) && <DbIpCredit />}
        </>
      )}
      {!data && !error && <Muted>Loading…</Muted>}
    </section>
  );
}
