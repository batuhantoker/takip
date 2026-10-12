'use client';

import { useState } from 'react';
import { useAdminData } from './admin-api';
import { Button, ErrorText, Muted, PageTitle, Select } from './admin-parts';
import type { AuditEvent } from './admin-types';
import AuditTable from './audit-table';

const PAGE = 100;
const KINDS = [
  ['', 'Everything'],
  ['plan.', 'Plans and grants'],
  ['override.', 'Overrides'],
  ['user.', 'Users (bans, sign-outs, roles)'],
  ['admin.', 'Console unlocks'],
] as const;

export default function AuditPage() {
  const [action, setAction] = useState('');
  const [pages, setPages] = useState<number[]>([]);
  const before = pages.at(-1);
  const { data, error } = useAdminData<{ events: AuditEvent[] }>(`/audit?limit=${PAGE}&action=${action}${before ? `&before=${before}` : ''}`);

  return (
    <>
      <PageTitle title="Audit log">
        <Select
          value={action}
          onChange={e => {
            setAction(e.target.value);
            setPages([]);
          }}
        >
          {KINDS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </Select>
      </PageTitle>
      <ErrorText message={error} />
      {data && (
        <div className="border border-[var(--border-primary)] bg-[#0A0A0A]">
          <AuditTable events={data.events} />
        </div>
      )}
      {!data && !error && <Muted>Loading…</Muted>}
      <div className="flex gap-3 mt-3">
        <Button disabled={!pages.length} onClick={() => setPages(pages.slice(0, -1))}>Newer</Button>
        <Button disabled={!data || data.events.length < PAGE} onClick={() => data && setPages([...pages, data.events.at(-1)!.id])}>Older</Button>
      </div>
    </>
  );
}
