'use client';

import Link from 'next/link';
import { useAdminData } from './admin-api';
import { Card, ErrorText, Muted, PageTitle } from './admin-parts';
import type { Overview } from './admin-types';
import AuditTable from './audit-table';

export default function OverviewPage() {
  const { data, error } = useAdminData<Overview>('/overview');
  return (
    <>
      <PageTitle title="Overview" />
      <ErrorText message={error} />
      {data && (
        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat label="Accounts" value={data.users} />
            <Stat label="New this week" value={data.newThisWeek} />
            <Stat label="Signed in now" value={data.signedInNow} />
            <Stat label="Unconfirmed email" value={data.unverified} />
            <Stat label="Admins" value={data.admins} />
            <Stat label="Banned" value={data.banned} />
            {Object.entries(data.onPaidOrGrantedPlans).map(([plan, count]) => <Stat key={plan} label={`On ${plan}`} value={count} />)}
          </div>
          <Card title="Recent changes">
            <AuditTable events={data.recent} />
            <Link href="/admin/audit" className="self-start text-[12px] text-[var(--gold-primary)] hover:underline">Full audit log</Link>
          </Card>
        </div>
      )}
      {!data && !error && <Muted>Loading…</Muted>}
    </>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="border border-[var(--border-primary)] bg-[#0A0A0A] px-4 py-3">
      <div className="text-[10px] uppercase tracking-[0.15em] text-[var(--text-muted)]">{label}</div>
      <div className="mt-1 text-xl font-mono tabular-nums">{value.toLocaleString('en')}</div>
    </div>
  );
}
