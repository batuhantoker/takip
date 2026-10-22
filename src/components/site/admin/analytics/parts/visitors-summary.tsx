import { ChartCard } from '@/components/site/admin/charts/chart-card';
import { StatTile } from '@/components/site/admin/charts/stat-tile';
import { TimeSeries } from '@/components/site/admin/charts/time-series';
import { Muted } from '@/components/site/admin/parts/admin-parts';
import type { PageJourneys } from '../analytics-types';
import { count, duration, longDay, minutes, minutesAxis, pct, plural, shortDay, sinceIndex, sum, weekDelta } from '../lib/format';
import { MAP_PATH } from '../lib/journeys';
import { ink, NEUTRAL } from '../lib/series';
import { Pair } from './section-frame';

const clock = (iso: string) => iso.slice(11, 16);

/** How the chart names its points: the hour for a day or less, day and hour up to three days, else the day. */
function axis(hours: number | null) {
  if (!hours) return { tick: shortDay, title: longDay };
  return {
    tick: (iso: string) => (hours <= 24 ? clock(iso) : `${shortDay(iso.slice(0, 10))} ${clock(iso)}`),
    title: (iso: string) => `${longDay(iso.slice(0, 10))}, ${clock(iso)} UTC`,
  };
}

/**
 * Who came and what they did, from the visit log and the hourly minute tables so every number covers the same window:
 * six figures, then visitors and time on the map per hour or day.
 */
export function VisitorsSummary({ j, hours, hitWall }: { j: PageJourneys; hours: number | null; hitWall: number }) {
  const { totals } = j;
  const points = j.series.map(b => new Date(b.at).toISOString());
  const days = points.map(p => p.slice(0, 10));
  const line = (key: 'visitors' | 'readers' | 'mapUsers' | 'minutes' | 'pageMapMinutes') => j.series.map(b => b[key]);
  const per = hours ? 'per hour' : 'per day';
  // Hours need the clock in their names; a day is named by its date alone, as shortDay expects.
  const x = hours ? points : days;
  const when = (i: number) => (hours ? `${days[i]} ${clock(points[i])}` : days[i]);
  // Week-on-week only means something on a daily series long enough to hold two weeks.
  const delta = (values: number[]) => (hours ? null : weekDelta(values, sinceIndex(days.map(day => ({ day })), j.since)));
  // A visit that lands on the map and stays there is one step but not a bounce, so leaving is measured on page landings.
  const pageLandings = j.flow.filter(f => f.landing !== MAP_PATH);
  const fromPage = sum(pageLandings.map(f => f.visits));
  const bounced = sum(pageLandings.filter(f => f.next === 'left').map(f => f.visits));
  const late = !hours && j.since && days[0] && j.since > days[0];
  const { tick, title } = axis(hours);

  return (
    <>
      {!j.since && <p className="text-[12px] text-ink-3">No visits logged yet. Each page view and map opening is logged from the first one after this was added.</p>}
      {late && <p className="text-[12px] text-ink-3">Visits are logged from {longDay(j.since!)}; earlier days have none.</p>}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <StatTile label="Visitors" value={count(totals.visitors)} sub={`${count(totals.new)} new · ${count(totals.signedIn)} with an account`}
          trend={line('visitors')} delta={delta(line('visitors'))} />
        <StatTile label="Read a page" value={count(totals.readers)} sub={`${pct(totals.readers, totals.visitors)} of visitors`}
          trend={line('readers')} delta={delta(line('readers'))} />
        <StatTile label="Opened the map" value={count(totals.mapUsers)} sub={`${pct(totals.mapUsers, totals.visitors)} of visitors · ${count(totals.both)} did both`}
          trend={line('mapUsers')} delta={delta(line('mapUsers'))} />
        <StatTile label="Time on the map" value={minutes(totals.minutes)} sub={`${minutes(totals.pageMapMinutes)} more on the pages' small maps`}
          trend={line('minutes')} delta={delta(line('minutes'))} />
        <StatTile label="Page to map" value={pct(totals.toMap, fromPage)} sub={`Of ${plural(fromPage, 'visit')} begun on a page · ${pct(bounced, fromPage)} left after it`} />
        <StatTile label="Visits" value={count(totals.visits)}
          sub={`${pct(totals.returning, totals.visits)} returning${totals.medianMs == null ? '' : ` · median ${duration(totals.medianMs)}`}`} />
      </div>

      <Pair>
        <ChartCard title={`Visitors ${per}`} note="Every visitor, and those who read a page or opened the map; one can do both"
          table={{ columns: [hours ? 'Hour (UTC)' : 'Day', 'Visitors', 'Read a page', 'Opened the map', 'Visits'], rows: j.series.map((b, i) => [when(i), b.visitors, b.readers, b.mapUsers, b.visits]).reverse() }}>
          {sum(line('visitors')) ? (
            <TimeSeries label={`Visitors ${per}`} days={x} tick={tick} title={title} trim={!hours} format={count} series={[
              { key: 'visitors', label: 'Visitors', color: NEUTRAL, values: line('visitors') },
              { key: 'readers', label: 'Read a page', color: ink(1), values: line('readers') },
              { key: 'map', label: 'Opened the map', color: ink(0), values: line('mapUsers') },
            ]} />
          ) : <Muted>No visitors in this range.</Muted>}
        </ChartCard>
        <ChartCard title={`Time on the map ${per}`}
          note={`Everyone's minutes on the full map, and the minutes readers moved, zoomed or clicked a page's small map${hitWall ? `; ${plural(hitWall, 'browser')} hit the daily limit` : ''}`}
          table={{ columns: [hours ? 'Hour (UTC)' : 'Day', 'Full map', 'Page maps'], rows: j.series.map((b, i) => [when(i), b.minutes, b.pageMapMinutes]).reverse() }}>
          {sum(line('minutes')) + sum(line('pageMapMinutes')) ? (
            <TimeSeries label={`Minutes on the map ${per}`} days={x} tick={tick} title={title} trim={!hours} format={minutes} axis={minutesAxis} series={[
              { key: 'full', label: 'Full map', color: ink(0), values: line('minutes') },
              { key: 'pages', label: "Pages' small maps", color: ink(2), values: line('pageMapMinutes') },
            ]} />
          ) : <Muted>No time on the map in this range.</Muted>}
        </ChartCard>
      </Pair>
    </>
  );
}
