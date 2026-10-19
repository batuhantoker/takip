import { BarList } from '@/components/site/admin/charts/bar-list';
import { ChartCard } from '@/components/site/admin/charts/chart-card';
import { Heatmap } from '@/components/site/admin/charts/heatmap';
import { Meter } from '@/components/site/admin/charts/meter';
import { StackedBars } from '@/components/site/admin/charts/stacked-bars';
import { Muted } from '@/components/site/admin/parts/admin-parts';
import type { UserAnalytics } from '@/components/site/admin/analytics/analytics-types';
import { featureLabel, splitFeature, VIEW_ORDER } from '@/components/site/admin/analytics/lib/features';
import { count, minutes, shortDay, sum } from '@/components/site/admin/analytics/lib/format';
import { ink } from '@/components/site/admin/analytics/lib/series';
import { Pair } from '@/components/site/admin/analytics/parts/section-frame';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const NONE = 'No map time in this range.';

type Feature = UserAnalytics['features'][number];

/** What the charts read: an account's activity, or a visitor's (VisitorAnalytics has the same fields). */
export type ActivityTime = Pick<UserAnalytics, 'features' | 'hours'> & { daily: { day: string; views: Record<string, number> }[] };

const rows = (features: Feature[]) =>
  features.map(f => ({ key: f.feature, label: featureLabel(f.feature), value: f.minutes, detail: `on ${count(f.days)} day${f.days === 1 ? '' : 's'}` }));

/** Where one account's or browser's map minutes went: by day and view, by panel, layer, window and device, and by weekday and hour. */
export default function UserActivityTime({ u, who = 'This account' }: { u: ActivityTime; who?: string }) {
  const of = (kind: string) => u.features.filter(f => splitFeature(f.feature).kind === kind).sort((a, b) => b.minutes - a.minutes);
  const views = of('view');
  const devices = of('device');
  const shownViews = VIEW_ORDER.filter(id => u.daily.some(d => (d.views[`view:${id}`] ?? 0) > 0));

  return (
    <>
      <Pair>
        <ChartCard
          title="Map time per day"
          note="Stacked by view: map, space view, History, Replay and the time-limit wall"
          table={{ columns: ['Day', ...shownViews.map(id => featureLabel(`view:${id}`))], rows: [...u.daily].reverse().map(d => [d.day, ...shownViews.map(id => d.views[`view:${id}`] ?? 0)]) }}
        >
          {shownViews.length ? (
            <StackedBars
              label={`${who}'s map minutes per day by view`}
              format={n => minutes(n)}
              columns={u.daily.map(d => ({ key: d.day, label: shortDay(d.day) }))}
              series={shownViews.map(id => ({ key: id, label: featureLabel(`view:${id}`), color: ink(VIEW_ORDER.indexOf(id)), values: u.daily.map(d => d.views[`view:${id}`] ?? 0) }))}
            />
          ) : <Muted>{NONE}</Muted>}
        </ChartCard>
        <ChartCard title="Views" note="Minutes in each view, and on how many days">
          <BarList format={minutes} share={false} rows={rows(views)} empty={NONE} />
        </ChartCard>
      </Pair>

      <Pair>
        <ChartCard title="Panels" note="Time with each sidebar panel open">
          <BarList format={minutes} share={false} limit={10} rows={rows(of('panel'))} empty="No panel time in this range." />
        </ChartCard>
        <ChartCard title="Layers" note="Minutes each data layer was on their map">
          <BarList format={minutes} share={false} limit={10} rows={rows(of('layer'))} empty="No layer time in this range." />
        </ChartCard>
      </Pair>

      <Pair>
        <ChartCard
          title="When they use the map"
          note="Their map minutes by weekday and hour (UTC)"
          table={{ columns: ['Weekday and hour (UTC)', 'Minutes'], rows: [...u.hours].sort((x, y) => y.minutes - x.minutes).map(h => [`${DAY_NAMES[h.dow]} ${String(h.hour).padStart(2, '0')}:00`, h.minutes]) }}
        >
          {u.hours.length ? <Heatmap cells={u.hours} /> : <Muted>{NONE}</Muted>}
        </ChartCard>
        <div className="flex flex-col gap-4">
          <ChartCard title="Windows" note="Camera players, live feeds, dossiers and search over the map">
            <BarList format={minutes} share={false} rows={rows(of('window'))} empty="No windows opened in this range." />
          </ChartCard>
          <ChartCard title="Devices" note="Map minutes on desktop and on a phone">
            {devices.length ? (
              <Meter
                format={minutes}
                total={sum(devices.map(d => d.minutes))}
                parts={['device:desktop', 'device:mobile'].map((f, i) => ({ label: featureLabel(f), value: devices.find(d => d.feature === f)?.minutes ?? 0, color: ink(i) }))}
              />
            ) : <Muted>{NONE}</Muted>}
          </ChartCard>
        </div>
      </Pair>
    </>
  );
}
