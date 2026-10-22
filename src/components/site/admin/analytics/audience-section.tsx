import Link from 'next/link';
import { BarList } from '@/components/site/admin/charts/bar-list';
import { ChartCard } from '@/components/site/admin/charts/chart-card';
import { CohortTable } from '@/components/site/admin/charts/cohort-table';
import { StackedBars } from '@/components/site/admin/charts/stacked-bars';
import { StatTile } from '@/components/site/admin/charts/stat-tile';
import { TimeSeries } from '@/components/site/admin/charts/time-series';
import { Muted } from '@/components/site/admin/parts/admin-parts';
import type { AnalyticsAudience } from './analytics-types';
import { count, minutes, pct, plural, pointNames, sinceIndex, sum, weekDelta } from './lib/format';
import { ink, NEUTRAL } from './lib/series';
import type { AnalyticsQuery } from './lib/use-analytics-data';
import { zoneName } from './lib/zone';
import { DbIpCredit, PlaceLabel } from './parts/place-label';
import { More } from './parts/more';
import { CollectingNote, Pair, SectionFrame, Tiles } from './parts/section-frame';

const PROVIDERS: Record<string, string> = { credential: 'Email and password', google: 'Google', github: 'GitHub', apple: 'Apple', microsoft: 'Microsoft', passkey: 'Passkey' };

/** `hours` is set for a window of hours, which the api answers hour by hour. */
export function AudienceSection({ query, hours }: { query: AnalyticsQuery<AnalyticsAudience>; hours: number | null }) {
  return <SectionFrame query={query}>{a => <Audience a={a} hours={a.hours ? hours : null} />}</SectionFrame>;
}

function Audience({ a, hours }: { a: AnalyticsAudience; hours: number | null }) {
  const { totals } = a;
  const rows = a.hours && hours ? a.hours.map(h => ({ ...h, point: new Date(h.at).toISOString() })) : a.days.map(d => ({ ...d, point: d.day }));
  const { tick, title, row } = pointNames(hours);
  const per = hours ? 'per hour' : 'per day';
  // Days here are kept by UTC day; a window of hours is named on the viewer's clock.
  const pointColumn = hours ? `Hour (${zoneName()})` : 'Day (UTC)';
  const days = rows.map(d => d.point);
  const columns = rows.map(d => ({ key: d.point, label: tick(d.point), title: title(d.point) }));
  const line = (key: 'signups' | 'sessions' | 'activeUsers' | 'activeVisitors') => rows.map(d => d[key]);
  const signups = line('signups');
  const sessions = line('sessions');
  const from = hours ? 0 : sinceIndex(a.days, a.since);
  const signupDelta = hours ? null : weekDelta(signups);
  const span = hours ? `the last ${hours} hours` : `${a.days.length} days`;
  const devices = (kind: 'browser' | 'os' | 'device') =>
    a.devices.filter(d => d.kind === kind).sort((x, y) => y.sessions - x.sessions).map(d => ({ key: d.name, label: d.name, value: d.sessions }));

  return (
    <>
      <p className="text-[12px] text-ink-3">
        Totals across accounts. <Link href="/admin/users" className="text-accent hover:underline">See every account&apos;s activity in Users</Link>, or open one for everything it did.
      </p>
      <Tiles>
        <StatTile label="Accounts" value={count(totals.users)} sub={`${count(sum(signups))} new in ${span}`} trend={signups} delta={signupDelta && { ...signupDelta, what: 'Sign-ups' }} />
        <StatTile label="Email confirmed" value={pct(totals.verified, totals.users)} sub={`${count(totals.verified)} of ${count(totals.users)}`} />
        <StatTile label="Two-factor on" value={pct(totals.twoFactor, totals.users)} sub={`${plural(totals.twoFactor, 'account')} · ${count(totals.banned)} banned`} />
        {/* A ratio of one or two accounts says nothing yet. */}
        <StatTile label="Stickiness" value={totals.mau < 3 ? '—' : pct(totals.dau, totals.mau)} sub={totals.mau < 3 ? 'Too few active accounts to say' : 'Active today ÷ active this month'} />
        <StatTile label="Active today" value={count(totals.dau)} trend={line('activeUsers')} delta={hours ? null : weekDelta(line('activeUsers'), from)} sub="Accounts with map time" />
        <StatTile label="Active this week" value={count(totals.wau)} sub={`${count(totals.mau)} this month`} />
        <StatTile label="Visitors today" value={count(totals.visitorsToday)} trend={line('activeVisitors')} delta={hours ? null : weekDelta(line('activeVisitors'), from)} />
        <StatTile label="Map time per active day" value={minutes(totals.avgUserMinutes)} sub={`Accounts · visitors ${minutes(totals.avgVisitorMinutes)}`} />
      </Tiles>

      <ChartCard
        title={`Active ${per}`}
        note={hours ? 'Accounts, and browsers with a visitor id, with map time in each hour' : <CollectingNote since={a.since} first={days[0]} />}
        table={{ columns: [pointColumn, 'Accounts', 'Visitors'], rows: [...rows].reverse().map(d => [row(d.point), d.activeUsers, d.activeVisitors]) }}
      >
        <TimeSeries
          label={`Active accounts and visitors ${per}`}
          days={days} tick={tick} title={title} trim={!hours}
          series={[
            { key: 'users', label: 'Accounts', color: ink(0), values: line('activeUsers') },
            { key: 'visitors', label: 'Visitors', color: ink(1), values: line('activeVisitors') },
          ]}
        />
      </ChartCard>

      <Pair>
        <ChartCard title={`Sign-ups ${per}`} table={{ columns: [pointColumn, 'Sign-ups'], rows: [...rows].reverse().map(d => [row(d.point), d.signups]) }}>
          {sum(signups) ? <StackedBars label={`Sign-ups ${per}`} days={!hours} columns={columns} series={[{ key: 'signups', label: 'Sign-ups', color: NEUTRAL, values: signups }]} /> : <Muted>No sign-ups in this range.</Muted>}
        </ChartCard>
        <ChartCard title={`Sign-ins ${per}`} note="New sessions, including each new device" table={{ columns: [pointColumn, 'Sign-ins'], rows: [...rows].reverse().map(d => [row(d.point), d.sessions]) }}>
          {sum(sessions) ? <StackedBars label={`Sign-ins ${per}`} days={!hours} columns={columns} series={[{ key: 'sessions', label: 'Sign-ins', color: NEUTRAL, values: sessions }]} /> : <Muted>No sign-ins in this range.</Muted>}
        </ChartCard>
      </Pair>

      <div className="grid gap-4 lg:grid-cols-3">
        <ChartCard title="Sign-in methods" note="Accounts with each method linked; one account can have several">
          <BarList format={count} total={totals.users} rows={a.providers.map(p => ({ key: p.provider, label: PROVIDERS[p.provider] ?? p.provider, value: p.users }))} />
        </ChartCard>
        <ChartCard title="Plans" note="Paid, granted or free, as each account resolves today">
          <BarList format={count} rows={a.plans.map(p => ({ key: p.plan, label: p.plan, value: p.users }))} />
        </ChartCard>
        <ChartCard title="Countries" note="Where accounts used the map from in the range; one account can be in several">
          <BarList
            format={count}
            share={false}
            rows={a.countries.map(c => ({ key: c.country, label: <PlaceLabel place={{ country: c.country }} />, value: c.users }))}
            empty="No placed map time in this range yet."
          />
          {a.countries.length > 0 && <DbIpCredit />}
        </ChartCard>
      </div>

      <More id="audience-devices" title="Devices and retention" holds="Browsers, systems and device types of sessions started in the range, and which sign-up weeks came back">
        <div className="grid gap-4 lg:grid-cols-3">
          <ChartCard title="Browsers"><BarList format={count} rows={devices('browser')} empty="No sessions in this range." /></ChartCard>
          <ChartCard title="Operating systems"><BarList format={count} rows={devices('os')} empty="No sessions in this range." /></ChartCard>
          <ChartCard title="Device types"><BarList format={count} rows={devices('device')} empty="No sessions in this range." /></ChartCard>
        </div>

        <ChartCard title="Retention by sign-up week" note="Share of each week's new accounts with map time in the weeks after (UTC, weeks start Monday)">
          {a.cohorts.length ? <CohortTable cohorts={a.cohorts} /> : <Muted>No sign-ups in this range to follow.</Muted>}
        </ChartCard>
      </More>
    </>
  );
}
