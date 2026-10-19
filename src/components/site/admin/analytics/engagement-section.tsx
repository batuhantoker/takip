import Link from 'next/link';
import { BarList } from '@/components/site/admin/charts/bar-list';
import { ChartCard } from '@/components/site/admin/charts/chart-card';
import { Heatmap } from '@/components/site/admin/charts/heatmap';
import { StackedBars } from '@/components/site/admin/charts/stacked-bars';
import { StatTile } from '@/components/site/admin/charts/stat-tile';
import { Muted } from '@/components/site/admin/parts/admin-parts';
import type { AnalyticsEngagement, FeatureUse } from './analytics-types';
import { featureLabel, featureLongLabel, splitFeature, VIEW_ORDER } from './lib/features';
import { count, minutes, pct, shortDay, sum } from './lib/format';
import { ink } from './lib/series';
import type { AnalyticsQuery } from './lib/use-analytics-data';
import { ActionCards } from './parts/action-cards';
import { FeatureCards, reach } from './parts/feature-cards';
import { CollectingNote, Pair, SectionFrame, Tiles } from './parts/section-frame';
import { TopUsersTable } from './parts/top-users-table';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function EngagementSection({ query }: { query: AnalyticsQuery<AnalyticsEngagement> }) {
  return <SectionFrame query={query}>{e => <Engagement e={e} />}</SectionFrame>;
}

const ofKind = (features: FeatureUse[], kind: string) => features.filter(f => splitFeature(f.feature).kind === kind).sort((a, b) => b.minutes - a.minutes);
const top = (features: FeatureUse[], skip: string[] = []) => features.find(f => !skip.includes(f.feature)) ?? null;

function Engagement({ e }: { e: AnalyticsEngagement }) {
  const views = ofKind(e.features, 'view');
  const panels = ofKind(e.features, 'panel');
  const layers = ofKind(e.features, 'layer');
  const devices = ofKind(e.features, 'device');
  const total = sum(views.map(v => v.minutes));
  const topPanel = top(panels, ['panel:none']);
  const topLayer = top(layers);
  const phone = devices.find(d => d.feature === 'device:mobile')?.minutes ?? 0;
  const columns = e.featureDays.map(d => ({ key: d.day, label: shortDay(d.day) }));
  const shownViews = VIEW_ORDER.filter(id => e.featureDays.some(d => (d.minutes[`view:${id}`] ?? 0) > 0));
  const walled = e.wall.some(d => d.users + d.visitors > 0);

  return (
    <>
      <CollectingNote since={e.since} first={e.featureDays[0]?.day} />
      <Tiles>
        <StatTile label="Map time in range" value={minutes(total)} sub={`${e.days} days`} trend={e.featureDays.map(d => sum(VIEW_ORDER.map(id => d.minutes[`view:${id}`] ?? 0)))} />
        <StatTile label="Most used panel" value={topPanel ? featureLabel(topPanel.feature) : '—'} sub={topPanel ? `${minutes(topPanel.minutes)} · ${reach(topPanel)}` : 'No panel opened yet'} />
        <StatTile label="Most used layer" value={topLayer ? featureLabel(topLayer.feature) : '—'} sub={topLayer ? `${minutes(topLayer.minutes)} · ${reach(topLayer)}` : 'No layer time yet'} />
        <StatTile label="On a phone" value={pct(phone, sum(devices.map(d => d.minutes)))} sub="Share of map minutes" />
      </Tiles>

      <Pair>
        <ChartCard
          title="Time by view per day"
          note="Map, space view, History, Replay, and minutes spent on the time-limit wall"
          table={{ columns: ['Day', ...shownViews.map(id => featureLabel(`view:${id}`))], rows: [...e.featureDays].reverse().map(d => [d.day, ...shownViews.map(id => d.minutes[`view:${id}`] ?? 0)]) }}
        >
          {shownViews.length ? (
            <StackedBars
              label="Map minutes per day by view"
              format={n => minutes(n)}
              columns={columns}
              series={shownViews.map(id => ({ key: id, label: featureLabel(`view:${id}`), color: ink(VIEW_ORDER.indexOf(id)), values: e.featureDays.map(d => d.minutes[`view:${id}`] ?? 0) }))}
            />
          ) : <Muted>No map time in this range yet.</Muted>}
        </ChartCard>
        <ChartCard title="Views" note="Minutes and how many people used each">
          <BarList format={minutes} share={false} rows={views.map(f => ({ key: f.feature, label: featureLabel(f.feature), value: f.minutes, detail: reach(f) }))} empty="No map time in this range yet." />
        </ChartCard>
      </Pair>

      <FeatureCards e={e} panels={panels} layers={layers} devices={devices} />
      <ActionCards e={e} />

      <ChartCard
        title="When people use the map"
        note="Map minutes by weekday and hour (UTC), everyone together"
        table={{ columns: ['Weekday and hour (UTC)', 'Minutes'], rows: [...e.hours].sort((x, y) => y.minutes - x.minutes).map(h => [`${DAY_NAMES[h.dow]} ${String(h.hour).padStart(2, '0')}:00`, h.minutes]) }}
      >
        {e.hours.length ? <Heatmap cells={e.hours} /> : <Muted>No map time in this range yet.</Muted>}
      </ChartCard>

      <Pair>
        <ChartCard
          title="Time per visit"
          note="Map minutes per person per day"
          table={{ columns: ['Minutes a day', 'Account-days', 'Visitor-days'], rows: e.sessionLength.map(b => [b.bucket, b.users, b.visitors]) }}
        >
          {e.sessionLength.some(b => b.users + b.visitors > 0) ? (
            <StackedBars
              label="Distribution of map minutes per person per day"
              format={count}
              columns={e.sessionLength.map(b => ({ key: b.bucket, label: b.bucket, title: `${b.bucket} min a day` }))}
              series={[
                { key: 'users', label: 'Account-days', color: ink(0), values: e.sessionLength.map(b => b.users) },
                { key: 'visitors', label: 'Visitor-days', color: ink(1), values: e.sessionLength.map(b => b.visitors) },
              ]}
            />
          ) : <Muted>No map time in this range yet.</Muted>}
        </ChartCard>
        <ChartCard
          title="Reached the daily time limit"
          note="People who used up their plan's map minutes and saw the wall"
          table={walled ? { columns: ['Day', 'Accounts', 'Visitors'], rows: [...e.wall].reverse().map(d => [d.day, d.users, d.visitors]) } : null}
        >
          {walled ? (
            <StackedBars
              label="People who reached the daily map limit, per day"
              format={count}
              columns={e.wall.map(d => ({ key: d.day, label: shortDay(d.day) }))}
              series={[
                { key: 'users', label: 'Accounts', color: ink(0), values: e.wall.map(d => d.users) },
                { key: 'visitors', label: 'Visitors', color: ink(1), values: e.wall.map(d => d.visitors) },
              ]}
            />
          ) : <Muted>Nobody reached the limit in this range.</Muted>}
        </ChartCard>
      </Pair>

      <ChartCard
        title="Most active accounts"
        note={`By map minutes over the last ${e.days} days`}
        actions={<Link href="/admin/users" className="text-[12px] text-accent hover:underline">Every account in Users</Link>}
      >
        {e.topUsers.length ? <TopUsersTable users={e.topUsers} label={featureLongLabel} /> : <Muted>No account has map time in this range yet.</Muted>}
      </ChartCard>
    </>
  );
}
