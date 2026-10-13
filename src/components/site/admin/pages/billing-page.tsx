'use client';

import Link from 'next/link';
import { useState } from 'react';
import { adminSend, useAdminData } from '@/components/site/admin/admin-api';
import { Badge, Button, Card, ErrorText, Muted, PageTitle, TABLE, TD, TH, day, when } from '@/components/site/admin/parts/admin-parts';
import type { BillingOverview } from '@/components/site/admin/admin-types';
import BillingJobsCard from '@/components/site/admin/parts/billing-jobs-card';
import { useAdminAction } from '@/components/site/admin/use-admin-action';

const LIVE = new Set(['active', 'trialing', 'past_due']);

export default function BillingPage() {
  const { data, error, reload } = useAdminData<BillingOverview>('/billing');
  const reconcile = useAdminAction(reload);
  const [notice, setNotice] = useState<string | null>(null);

  const rerun = () =>
    reconcile.run(async () => {
      const result = await adminSend<{ jobId: number; queued: boolean }>('POST', '/billing/reconcile');
      setNotice(result.queued ? `Reconciliation queued (job #${result.jobId}). It runs within a few seconds.` : `A reconciliation is already waiting to run (job #${result.jobId}).`);
    });

  if (error) return <ErrorText message={error} />;
  if (!data) return <Muted>Loading…</Muted>;
  const { provider, subscriptions, events, jobs } = data;

  return (
    <>
      <PageTitle title="Billing">
        <Button tone="gold" disabled={!provider || reconcile.busy} onClick={() => void rerun()}>Re-run reconciliation</Button>
      </PageTitle>
      {!provider && (
        <div className="mb-4 rounded-card border border-line bg-surface-2 border-l-2 border-l-amber px-4 py-3 text-[13px] text-ink-2">
          No billing provider is configured (<span className="font-mono">BILLING_PROVIDER</span> is unset). Checkout and the customer portal are off and
          nothing reconciles. Plans granted by hand from a user&apos;s page still work.
        </div>
      )}
      {notice && <p className="mb-3 text-[12px] text-ink-3">{notice}</p>}
      <ErrorText message={reconcile.error} />

      <div className="grid gap-4">
        <Card title="Subscriptions by status">
          {subscriptions.byStatus.length ? (
            <div className="flex flex-wrap gap-2">
              {subscriptions.byStatus.map(s => (
                <Badge key={`${s.provider}:${s.status}`} tone={LIVE.has(s.status) ? 'gold' : 'muted'}>{s.provider} · {s.status} · {s.count}</Badge>
              ))}
            </div>
          ) : (
            <Muted>No subscriptions yet.</Muted>
          )}
          {subscriptions.recent.length > 0 && (
            <div className="overflow-x-auto">
              <table className={TABLE}>
                <thead>
                  <tr>
                    <th className={TH}>User</th>
                    <th className={TH}>Plan</th>
                    <th className={TH}>Status</th>
                    <th className={TH}>Period ends</th>
                    <th className={TH}>Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {subscriptions.recent.map(s => (
                    <tr key={`${s.provider}:${s.providerSubId}`}>
                      <td className={TD}><Link href={`/admin/users/${s.userId}`} className="hover:underline">{s.email ?? s.userId}</Link></td>
                      <td className={TD}>{s.planId} <span className="text-[11px] text-ink-3">via {s.provider}</span></td>
                      <td className={TD}><Badge tone={LIVE.has(s.status) ? 'gold' : 'muted'}>{s.status}</Badge></td>
                      <td className={`${TD} whitespace-nowrap text-ink-3`}>{day(s.periodEnd)}</td>
                      <td className={`${TD} whitespace-nowrap text-ink-3`}>{when(s.updatedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card title="Provider events">
          {events.length ? (
            <div className="overflow-x-auto">
              <table className={TABLE}>
                <thead>
                  <tr>
                    <th className={TH}>Received</th>
                    <th className={TH}>Type</th>
                    <th className={TH}>Event</th>
                    <th className={TH}>Processed</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map(e => (
                    <tr key={`${e.provider}:${e.eventId}`}>
                      <td className={`${TD} whitespace-nowrap text-ink-3`}>{when(e.receivedAt)}</td>
                      <td className={`${TD} font-mono text-[11px]`}>{e.type}</td>
                      <td className={`${TD} font-mono text-[11px] text-ink-3 break-all`}>{e.provider} · {e.eventId}</td>
                      <td className={TD}>
                        {e.processedAt !== null ? <span className="text-ink-3">{when(e.processedAt)}</span> : <Badge tone="danger">not applied</Badge>}
                        {e.error && <span className="block text-[11px] text-red break-words">{e.error}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Muted>No webhook deliveries yet.</Muted>
          )}
        </Card>

        <BillingJobsCard jobs={jobs} />
      </div>
    </>
  );
}
