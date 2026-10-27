import type { ReactNode } from 'react';
import { StatTile } from '@/components/site/admin/charts/stat-tile';
import type {
  AnalyticsApi, AnalyticsAudience, AnalyticsEngagement, AnalyticsLive, AnalyticsPages, AnalyticsStorage, AnalyticsSystem, AnalyticsVisitors,
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
  live: AnalyticsQuery<AnalyticsLive>;
};

/** A tile that waits on its own endpoint: '…' while loading, the error under the label if it failed. */
function Pending<T>({ label, query, children }: { label: string; query: AnalyticsQuery<T>; children: (data: T) => ReactNode }) {
  if (query.data) return <>{children(query.data)}</>;
  return <StatTile label={label} value={query.error ? '—' : '…'} sub={query.error} />;
}

/**
 * The first look: what needs attention, eight numbers for now and today, and the top of three lists. Every other
 * number is in its tab, which the attention rows and the lists link to.
 */
export function OverviewSection({ attention, hours, ...q }: Queries & { attention: Attention[]; hours: number | null }) {
  const loading = !q.system.data || !q.storage.data;
  const problems = attention.filter(a => a.tone !== 'news').length;
  return (
    <>
      <AttentionList items={attention} loading={loading} />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Pending label="Here now" query={q.live}>
          {l => {
            const onMap = l.people.filter(p => p.kind === 'map').length;
            return <StatTile label="Here now" value={count(l.people.length)} sub={`${count(onMap)} on the map · ${count(l.people.length - onMap)} reading`} />;
          }}
        </Pending>
        {hours ? <WindowTiles hours={hours} q={q} /> : <TodayTiles q={q} />}
        <Pending label="API requests today" query={q.api}>
          {p => {
            const today = p.days[p.days.length - 1];
            return <StatTile label="API requests today" value={compact(today?.requests ?? 0)} sub={`${count(today?.denied ?? 0)} refused · ${plural(today?.callers ?? 0, 'caller')}`}
              trend={p.days.map(d => d.requests)} delta={weekDelta(p.days.map(d => d.requests))} />;
          }}
        </Pending>
        <Pending label="Open reports" query={q.system}>
          {s => <StatTile label="Open reports" value={count(s.reports.open)} sub={`${count(s.reports.resolved)} resolved`} />}
        </Pending>
        <Pending label="System" query={q.system}>
          {s => <StatTile label="System" value={loading ? '…' : problems ? plural(problems, 'issue') : 'OK'}
            sub={`Up ${duration(s.now - s.startedAt)}${q.storage.data?.disk ? ` · ${bytes(q.storage.data.disk.free)} disk free` : ''}`} />}
        </Pending>
      </div>

      <TopLists pages={q.pages} engagement={q.engagement} hours={hours} />
    </>
  );
}

/** A window of hours, from the visit log and the hourly tables, the same numbers the Visitors tab shows. */
function WindowTiles({ hours, q }: { hours: number; q: Pick<Queries, 'audience' | 'pages'> }) {
  const span = hours === 72 ? 'last 3 days' : `last ${hours} h`;
  return (
    <>
      <Pending label={`People, ${span}`} query={q.pages}>
        {p => <StatTile label={`People, ${span}`} value={count(p.journeys.totals.visitors)} trend={p.journeys.series.map(b => b.visitors)}
          sub={`${count(p.journeys.totals.readers)} read a page · ${count(p.journeys.totals.mapUsers)} opened the map`} />}
      </Pending>
      <Pending label={`Map time, ${span}`} query={q.pages}>
        {p => <StatTile label={`Map time, ${span}`} value={minutes(p.journeys.totals.minutes)} trend={p.journeys.series.map(b => b.minutes)}
          sub={`${minutes(p.journeys.totals.pageMapMinutes)} more on the pages' small maps`} />}
      </Pending>
      <Pending label={`Visits, ${span}`} query={q.pages}>
        {p => <StatTile label={`Visits, ${span}`} value={count(p.journeys.totals.visits)} trend={p.journeys.series.map(b => b.visits)}
          sub={`${pct(p.journeys.totals.returning, p.journeys.totals.visits)} returning`} />}
      </Pending>
      <Pending label="New accounts" query={q.audience}>
        {a => {
          const signups = (a.hours ?? []).map(h => h.signups);
          return <StatTile label="New accounts" value={count(sum(signups))} sub={`${count(a.totals.users)} in all · in the ${span}`} trend={signups} />;
        }}
      </Pending>
    </>
  );
}

function TodayTiles({ q }: { q: Pick<Queries, 'audience' | 'pages'> }) {
  return (
    <>
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
    </>
  );
}
