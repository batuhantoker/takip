import type { ReactNode } from 'react';
import { BarList } from '@/components/site/admin/charts/bar-list';
import { ChartCard } from '@/components/site/admin/charts/chart-card';
import { StackedBars } from '@/components/site/admin/charts/stacked-bars';
import { StatTile } from '@/components/site/admin/charts/stat-tile';
import { TimeSeries } from '@/components/site/admin/charts/time-series';
import { ErrorText } from '@/components/site/admin/parts/admin-parts';
import type { AnalyticsApi, AnalyticsAudience, AnalyticsData, AnalyticsEngagement, AnalyticsStorage } from './analytics-types';
import { featureLongLabel, splitFeature } from './lib/features';
import { bytes, compact, count, minutes, shortDay, sinceIndex, sum, weekDelta } from './lib/format';
import { ink, NEUTRAL, REFUSED } from './lib/series';
import type { AnalyticsQuery } from './lib/use-analytics-data';
import { CollectingNote, Pair, Tiles } from './parts/section-frame';

type Queries = {
  audience: AnalyticsQuery<AnalyticsAudience>;
  engagement: AnalyticsQuery<AnalyticsEngagement>;
  api: AnalyticsQuery<AnalyticsApi>;
  storage: AnalyticsQuery<AnalyticsStorage>;
  data: AnalyticsQuery<AnalyticsData>;
};

/** A tile that waits on its own endpoint: '…' while loading, the error under the label if it failed. */
function Pending<T>({ label, query, children }: { label: string; query: AnalyticsQuery<T>; children: (data: T) => ReactNode }) {
  if (query.data) return <>{children(query.data)}</>;
  return <StatTile label={label} value={query.error ? '—' : '…'} sub={query.error} />;
}

export function OverviewSection({ audience, engagement, api, storage, data }: Queries) {
  return (
    <>
      <Tiles>
        <Pending label="Accounts" query={audience}>
          {a => {
            const delta = weekDelta(a.days.map(d => d.signups));
            return <StatTile label="Accounts" value={count(a.totals.users)} sub={`${count(a.totals.verified)} confirmed · ${count(a.totals.twoFactor)} with 2FA`}
              trend={a.days.map(d => d.signups)} delta={delta && { ...delta, what: 'Sign-ups' }} />;
          }}
        </Pending>
        <Pending label="Active accounts today" query={audience}>
          {a => <StatTile label="Active accounts today" value={count(a.totals.dau)} sub={`${count(a.totals.wau)} this week · ${count(a.totals.mau)} this month`}
            trend={a.days.map(d => d.activeUsers)} delta={weekDelta(a.days.map(d => d.activeUsers), sinceIndex(a.days, a.since))} />}
        </Pending>
        <Pending label="Visitors today" query={audience}>
          {a => <StatTile label="Visitors today" value={count(a.totals.visitorsToday)} sub="Signed out, counted per address block"
            trend={a.days.map(d => d.activeVisitors)} delta={weekDelta(a.days.map(d => d.activeVisitors), sinceIndex(a.days, a.since))} />}
        </Pending>
        <Pending label="Map time today" query={audience}>
          {a => {
            const perDay = a.days.map(d => d.userMinutes + d.visitorMinutes);
            return <StatTile label="Map time today" value={minutes(perDay[perDay.length - 1] ?? 0)} sub={`${minutes(sum(perDay))} in ${a.days.length} days`}
              trend={perDay} delta={weekDelta(perDay, sinceIndex(a.days, a.since))} />;
          }}
        </Pending>
        <Pending label="Per active account" query={audience}>
          {a => <StatTile label="Per active account" value={minutes(a.totals.avgUserMinutes)} sub={`Visitors: ${minutes(a.totals.avgVisitorMinutes)} a day`} />}
        </Pending>
        <Pending label="API requests today" query={api}>
          {p => {
            const today = p.days[p.days.length - 1];
            return <StatTile label="API requests today" value={compact(today?.requests ?? 0)} sub={`${count(today?.denied ?? 0)} refused · ${count(today?.callers ?? 0)} callers`}
              trend={p.days.map(d => d.requests)} delta={weekDelta(p.days.map(d => d.requests))} />;
          }}
        </Pending>
        <Pending label="Data on disk" query={storage}>
          {s => <StatTile label="Data on disk" value={bytes(s.total)} sub={s.disk ? `${bytes(s.disk.free)} free of ${bytes(s.disk.total)}` : 'Disk size unknown'} />}
        </Pending>
        <Pending label="Records ingested" query={data}>
          {d => d.available
            ? <StatTile label="Records ingested" value={compact(sum(d.days.map(x => x.records)))} sub={`${count(sum(d.days.map(x => x.failed)))} failed runs in ${d.days.length} days`}
              trend={d.days.map(x => x.records)} />
            : <StatTile label="Records ingested" value="—" sub="No ingest has run yet" />}
        </Pending>
      </Tiles>

      <ChartCard
        title="Map time per day"
        note={audience.data ? <CollectingNote since={audience.data.since} first={audience.data.days[0]?.day} /> : undefined}
        table={audience.data && {
          columns: ['Day', 'Accounts (min)', 'Visitors (min)'],
          rows: [...audience.data.days].reverse().map(d => [d.day, d.userMinutes, d.visitorMinutes]),
        }}
      >
        {audience.error && !audience.data && <ErrorText message={audience.error} />}
        {audience.data && (
          <TimeSeries
            label="Map minutes per day, accounts against visitors"
            days={audience.data.days.map(d => d.day)}
            format={compact}
            series={[
              { key: 'users', label: 'Accounts', color: ink(0), values: audience.data.days.map(d => d.userMinutes) },
              { key: 'visitors', label: 'Visitors', color: ink(1), values: audience.data.days.map(d => d.visitorMinutes) },
            ]}
          />
        )}
      </ChartCard>

      <Pair>
        <ChartCard title="Where the time goes" note="Panels, views and layers by map minutes in the range">
          {engagement.error && !engagement.data && <ErrorText message={engagement.error} />}
          {engagement.data && (
            <BarList
              format={minutes}
              share={false}
              empty="No map minutes in this range yet."
              rows={[...engagement.data.features]
                .sort((a, b) => b.minutes - a.minutes)
                .filter(f => ['view', 'panel', 'layer'].includes(splitFeature(f.feature).kind) && f.feature !== 'panel:none' && f.feature !== 'view:map')
                .slice(0, 8)
                .map(f => ({ key: f.feature, label: featureLongLabel(f.feature), value: f.minutes, detail: `${count(f.users)} accounts · ${count(f.visitors)} visitor-days` }))}
            />
          )}
        </ChartCard>
        <ChartCard title="API requests per day" note="Served and refused (rate-limited or over quota)">
          {api.error && !api.data && <ErrorText message={api.error} />}
          {api.data && (
            <StackedBars
              label="API requests per day, served and refused"
              columns={api.data.days.map(d => ({ key: d.day, label: shortDay(d.day) }))}
              series={[
                { key: 'served', label: 'Served', color: NEUTRAL, values: api.data.days.map(d => d.requests) },
                { key: 'refused', label: 'Refused', color: REFUSED, values: api.data.days.map(d => d.denied) },
              ]}
            />
          )}
        </ChartCard>
      </Pair>
    </>
  );
}
