import Link from 'next/link';
import { ChartCard } from '@/components/site/admin/charts/chart-card';
import { Badge, Muted, when } from '@/components/site/admin/parts/admin-parts';
import type { UserAnalytics } from '@/components/site/admin/analytics/analytics-types';
import { count } from '@/components/site/admin/analytics/lib/format';
import { Pair } from '@/components/site/admin/analytics/parts/section-frame';

/** Workspaces they saved (deleted ones stay in app.db until the account goes) and the issues they reported. */
export default function UserBelongings({ u }: { u: UserAnalytics }) {
  const live = u.workspaces.filter(w => w.deletedAt == null).length;
  return (
    <Pair>
      <ChartCard title="Workspaces" note={`${count(live)} saved · ${count(u.workspaces.length - live)} deleted`}>
        {u.workspaces.length ? (
          <ul className="flex flex-col gap-2 text-[12px]">
            {[...u.workspaces].sort((a, b) => b.updatedAt - a.updatedAt).map(w => (
              <li key={w.id} className={`flex items-start justify-between gap-3 border-b border-line pb-2 ${w.deletedAt ? 'text-ink-3' : ''}`}>
                <div className="min-w-0">
                  <span className={`block truncate ${w.deletedAt ? 'line-through' : 'text-ink-1'}`}>{w.name}</span>
                  <span className="text-[11px] text-ink-3">
                    Created {when(w.createdAt)} · {w.deletedAt ? `deleted ${when(w.deletedAt)}` : `updated ${when(w.updatedAt)}`}
                  </span>
                </div>
                <Badge tone={w.visibility === 'private' ? 'muted' : 'plain'}>{w.visibility}</Badge>
              </li>
            ))}
          </ul>
        ) : <Muted>No workspaces saved.</Muted>}
      </ChartCard>
      <ChartCard title="Issue reports" note="What they sent from the map" actions={u.reports.length ? <Link href="/admin/reports" className="text-[12px] text-accent hover:underline">Open reports</Link> : undefined}>
        {u.reports.length ? (
          <ul className="flex flex-col gap-2 text-[12px]">
            {u.reports.map(r => (
              <li key={r.id} className="flex items-start justify-between gap-3 border-b border-line pb-2">
                <div className="min-w-0">
                  <p className="line-clamp-2 text-ink-1">{r.message}</p>
                  <span className="text-[11px] text-ink-3">#{r.id} · {when(r.createdAt)}</span>
                </div>
                <Badge tone={r.status === 'open' ? 'plain' : 'muted'}>{r.status}</Badge>
              </li>
            ))}
          </ul>
        ) : <Muted>No reports sent.</Muted>}
      </ChartCard>
    </Pair>
  );
}
