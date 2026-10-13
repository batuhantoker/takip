'use client';

import Link from 'next/link';
import { useAdminData } from '@/components/site/admin/admin-api';
import { Card, ErrorText, Muted, PageTitle } from '@/components/site/admin/parts/admin-parts';
import type { Overview } from '@/components/site/admin/admin-types';
import AuditTable from '@/components/site/admin/tables/audit-table';

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
            <Link href="/admin/audit" className="self-start text-[12px] text-accent hover:underline">Full audit log</Link>
          </Card>
        </div>
      )}
      {!data && !error && <Muted>Loading…</Muted>}
    </>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="border border-line bg-surface-1 px-4 py-3">
      <div className="text-[11px] text-ink-3">{label}</div>
      <div className="mt-1 text-xl font-mono tabular-nums">{value.toLocaleString('en')}</div>
    </div>
  );
}
