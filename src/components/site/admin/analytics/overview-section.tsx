import type { ReactNode } from 'react';
import { StatTile } from '@/components/site/admin/charts/stat-tile';
import type {
  AnalyticsApi, AnalyticsAudience, AnalyticsEngagement, AnalyticsPages, AnalyticsStorage, AnalyticsSystem, AnalyticsVisitors,
} from './analytics-types';
import type { Attention } from './lib/attention';
import { bytes, compact, count, duration, minutes, pct, plural, sinceIndex, sum, weekDelta } from './lib/format';
import type { AnalyticsQuery } from './lib/use-analytics-data';
import { AttentionList } from './parts/attention-list';
import { TopLists } from './parts/top-lists';

type Queries = {
  audience: AnalyticsQuery<AnalyticsAudience>;
  visitors: AnalyticsQuery<AnalyticsVisitors>;
  pages: AnalyticsQuery<AnalyticsPages>;
  engagement: AnalyticsQuery<AnalyticsEngagement>;
  api: AnalyticsQuery<AnalyticsApi>;
  storage: AnalyticsQuery<AnalyticsStorage>;
  system: AnalyticsQuery<AnalyticsSystem>;
};

/** A tile that waits on its own endpoint: '…' while loading, the error under the label if it failed. */
function Pending<T>({ label, query, children }: { label: string; query: AnalyticsQuery<T>; children: (data: T) => ReactNode }) {
  if (query.data) return <>{children(query.data)}</>;
  return <StatTile label={label} value={query.error ? '—' : '…'} sub={query.error} />;
}

/**
 * The first look: what needs attention, six numbers for today, and the top of three lists. Every other number is
 * in its tab, which the attention rows and the lists link to.
 */
export function OverviewSection({ attention, ...q }: Queries & { attention: Attention[] }) {
  const loading = !q.system.data || !q.storage.data;
  const problems = attention.filter(a => a.tone !== 'news').length;
  return (
    <>
      <AttentionList items={attention} loading={loading} />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <Pending label="People today" query={q.audience}>
          {a => {
            const perDay = a.days.map(d => d.activeVisitors + d.activeUsers);
            return <StatTile label="People today" value={count(a.totals.visitorsToday + a.totals.dau)}
              sub={`${plural(a.totals.visitorsToday, 'visitor')} · ${plural(a.totals.dau, 'account')}`}
              trend={perDay} delta={weekDelta(perDay, sinceIndex(a.days, a.since))} />;
          }}
        </Pending>
        <Pending label="Map time today" query={q.audience}>
          {a => {
            const perDay = a.days.map(d => d.userMinutes + d.visitorMinutes);
            return <StatTile label="Map time today" value={minutes(perDay[perDay.length - 1] ?? 0)} sub={`${minutes(sum(perDay))} in the range`}
              trend={perDay} delta={weekDelta(perDay, sinceIndex(a.days, a.since))} />;
          }}
        </Pending>
        <Pending label="Page reads today" query={q.pages}>
          {p => {
            const perDay = p.daily.map(d => d.views);
            return <StatTile label="Page reads today" value={count(perDay[perDay.length - 1] ?? 0)}
              sub={p.totals.readers ? `${pct(p.totals.toMap, p.totals.readers)} of readers opened the map` : 'Public pages, from search and shares'}
              trend={perDay} delta={weekDelta(perDay)} />;
          }}
        </Pending>
        <Pending label="New accounts" query={q.audience}>
          {a => {
            const signups = a.days.map(d => d.signups);
            return <StatTile label="New accounts" value={count(sum(signups))} sub={`${count(a.totals.users)} in all · in ${a.days.length} days`}
              trend={signups} delta={weekDelta(signups)} />;
          }}
        </Pending>
        <Pending label="API requests today" query={q.api}>
          {p => {
            const today = p.days[p.days.length - 1];
            return <StatTile label="API requests today" value={compact(today?.requests ?? 0)} sub={`${count(today?.denied ?? 0)} refused · ${plural(today?.callers ?? 0, 'caller')}`}
              trend={p.days.map(d => d.requests)} delta={weekDelta(p.days.map(d => d.requests))} />;
          }}
        </Pending>
        <Pending label="System" query={q.system}>
          {s => <StatTile label="System" value={loading ? '…' : problems ? plural(problems, 'issue') : 'OK'}
            sub={`Up ${duration(s.now - s.startedAt)}${q.storage.data?.disk ? ` · ${bytes(q.storage.data.disk.free)} disk free` : ''}`} />}
        </Pending>
      </div>

      <TopLists pages={q.pages} engagement={q.engagement} />
    </>
  );
}
