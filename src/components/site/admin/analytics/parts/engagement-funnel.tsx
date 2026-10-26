import { BarList } from '@/components/site/admin/charts/bar-list';
import { ChartCard } from '@/components/site/admin/charts/chart-card';
import type { AnalyticsEngagement } from '../analytics-types';
import { count, longDay, minutes, pct, plural } from '../lib/format';

/**
 * How far people got, from arriving to making an account, with the time-limit wall beside it. Steps aren't nested: each
 * counts everyone who took it, so coming back can be rarer than opening sign-up.
 */
export function EngagementFunnel({ e }: { e: AnalyticsEngagement }) {
  const { funnel: f } = e;
  const map = f.openedMap;
  const ofMap = (n: number) => (map ? `${pct(n, map)} of people on the map` : undefined);
  const steps = [
    { key: 'arrived', label: 'Arrived on a page or the map', value: f.arrived },
    { key: 'map', label: 'Opened the map', value: map },
    { key: 'stayed', label: 'Stayed 2 min or more', value: f.stayed, detail: ofMap(f.stayed) },
    { key: 'back', label: 'Came back another day', value: f.cameBack, detail: ofMap(f.cameBack) },
    { key: 'sign-up', label: 'Opened sign-up', value: f.signUpOpened, detail: ofMap(f.signUpOpened) },
    { key: 'account', label: 'Made an account', value: f.signedUp, detail: 'Every account made in the range' },
  ];
  const wall = e.features.find(x => x.feature === 'view:wall');
  const late = e.viewsSince && e.daily[0] && e.viewsSince > e.daily[0].day;

  return (
    <ChartCard
      title="Funnel"
      note={`Each step counts everyone who took it, not only those who took the one before.${late ? ` Arrivals are logged from ${longDay(e.viewsSince!)}.` : ''}`}
      table={{ columns: ['Step', 'People'], rows: [...steps.map(s => [s.label, s.value]), ['Hit the time limit', wall?.people ?? 0]] }}
    >
      <BarList format={count} total={f.arrived} limit={steps.length} rows={steps} empty="No one arrived in this range." />
      <div className="flex flex-col gap-0.5 border-t border-line pt-3">
        <div className="flex items-baseline justify-between gap-3 text-[12px]">
          <span className="text-ink-1">Hit the time limit</span>
          <span className="font-mono tabular-nums text-ink-1">{count(wall?.people ?? 0)}</span>
        </div>
        <p className="text-[11px] text-ink-3">
          {wall?.people
            ? `${minutes(wall.minutes)} on the wall${wall.people > 1 ? ` in all, about ${minutes(wall.medianMinutes)} each` : ''}. Not counted as map time.`
            : 'Nobody used up their daily map minutes in this range.'}
        </p>
      </div>
    </ChartCard>
  );
}

/** People by their minutes on the map over the range, the medians in the tiles above. */
export function EngagementStay({ e }: { e: AnalyticsEngagement }) {
  const { people, visitors, accounts } = e.totals;
  return (
    <ChartCard
      title="Time on the map"
      note="Each person's minutes over the range. A minute counts when it begins, the first a few seconds in, so under 1 min means the second never began."
      table={{ columns: ['Minutes over the range', 'People'], rows: e.length.map(b => [b.bucket, b.people]) }}
    >
      {people ? (
        <>
          <BarList format={count} total={people} limit={e.length.length} rows={e.length.map(b => ({ key: b.bucket, label: b.bucket, value: b.people }))} />
          <p className="text-[11px] text-ink-3">
            {plural(people, 'person', 'people')} on the map: {plural(visitors, 'browser')} signed out, {plural(accounts, 'account')}. A browser signed in counts once, as its account.
          </p>
        </>
      ) : <p className="text-[12px] text-ink-3">No one used the map in this range.</p>}
    </ChartCard>
  );
}
