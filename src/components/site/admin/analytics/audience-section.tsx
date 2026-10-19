import Link from 'next/link';
import { BarList } from '@/components/site/admin/charts/bar-list';
import { ChartCard } from '@/components/site/admin/charts/chart-card';
import { CohortTable } from '@/components/site/admin/charts/cohort-table';
import { StackedBars } from '@/components/site/admin/charts/stacked-bars';
import { StatTile } from '@/components/site/admin/charts/stat-tile';
import { TimeSeries } from '@/components/site/admin/charts/time-series';
import { Muted } from '@/components/site/admin/parts/admin-parts';
import type { AnalyticsAudience } from './analytics-types';
import { count, minutes, pct, shortDay, sinceIndex, sum, weekDelta } from './lib/format';
import { ink, NEUTRAL } from './lib/series';
import type { AnalyticsQuery } from './lib/use-analytics-data';
import { DbIpCredit, PlaceLabel } from './parts/place-label';
import { CollectingNote, Pair, SectionFrame, SectionHeading, Tiles } from './parts/section-frame';

const PROVIDERS: Record<string, string> = { credential: 'Email and password', google: 'Google', github: 'GitHub', apple: 'Apple', microsoft: 'Microsoft', passkey: 'Passkey' };

export function AudienceSection({ query }: { query: AnalyticsQuery<AnalyticsAudience> }) {
  return <SectionFrame query={query}>{a => <Audience a={a} />}</SectionFrame>;
}

function Audience({ a }: { a: AnalyticsAudience }) {
  const { totals } = a;
  const days = a.days.map(d => d.day);
  const columns = a.days.map(d => ({ key: d.day, label: shortDay(d.day) }));
  const signups = a.days.map(d => d.signups);
  const sessions = a.days.map(d => d.sessions);
  const from = sinceIndex(a.days, a.since);
  const signupDelta = weekDelta(signups);
  const devices = (kind: 'browser' | 'os' | 'device') =>
    a.devices.filter(d => d.kind === kind).sort((x, y) => y.sessions - x.sessions).map(d => ({ key: d.name, label: d.name, value: d.sessions }));

  return (
    <>
      <p className="text-[12px] text-ink-3">
        Totals across accounts. <Link href="/admin/users" className="text-accent hover:underline">See every account&apos;s activity in Users</Link>, or open one for everything it did.
      </p>
      <Tiles>
        <StatTile label="Accounts" value={count(totals.users)} sub={`${count(sum(signups))} new in ${a.days.length} days`} trend={signups} delta={signupDelta && { ...signupDelta, what: 'Sign-ups' }} />
        <StatTile label="Email confirmed" value={pct(totals.verified, totals.users)} sub={`${count(totals.verified)} of ${count(totals.users)}`} />
        <StatTile label="Two-factor on" value={pct(totals.twoFactor, totals.users)} sub={`${count(totals.twoFactor)} accounts · ${count(totals.banned)} banned`} />
        <StatTile label="Stickiness" value={pct(totals.dau, totals.mau)} sub="Active today ÷ active this month" />
        <StatTile label="Active today" value={count(totals.dau)} trend={a.days.map(d => d.activeUsers)} delta={weekDelta(a.days.map(d => d.activeUsers), from)} sub="Accounts with map time" />
        <StatTile label="Active this week" value={count(totals.wau)} sub={`${count(totals.mau)} this month`} />
        <StatTile label="Visitors today" value={count(totals.visitorsToday)} trend={a.days.map(d => d.activeVisitors)} delta={weekDelta(a.days.map(d => d.activeVisitors), from)} />
        <StatTile label="Map time per active day" value={minutes(totals.avgUserMinutes)} sub={`Accounts · visitors ${minutes(totals.avgVisitorMinutes)}`} />
      </Tiles>

      <ChartCard
        title="Active per day"
        note={<CollectingNote since={a.since} first={days[0]} />}
        table={{ columns: ['Day', 'Accounts', 'Visitors'], rows: [...a.days].reverse().map(d => [d.day, d.activeUsers, d.activeVisitors]) }}
      >
        <TimeSeries
          label="Active accounts and visitors per day"
          days={days}
          series={[
            { key: 'users', label: 'Accounts', color: ink(0), values: a.days.map(d => d.activeUsers) },
            { key: 'visitors', label: 'Visitors', color: ink(1), values: a.days.map(d => d.activeVisitors) },
          ]}
        />
      </ChartCard>

      <Pair>
        <ChartCard title="Sign-ups per day" table={{ columns: ['Day', 'Sign-ups'], rows: [...a.days].reverse().map(d => [d.day, d.signups]) }}>
          {sum(signups) ? <StackedBars label="Sign-ups per day" columns={columns} series={[{ key: 'signups', label: 'Sign-ups', color: NEUTRAL, values: signups }]} /> : <Muted>No sign-ups in this range.</Muted>}
        </ChartCard>
        <ChartCard title="Sign-ins per day" note="New sessions, including each new device" table={{ columns: ['Day', 'Sign-ins'], rows: [...a.days].reverse().map(d => [d.day, d.sessions]) }}>
          {sum(sessions) ? <StackedBars label="Sign-ins per day" columns={columns} series={[{ key: 'sessions', label: 'Sign-ins', color: NEUTRAL, values: sessions }]} /> : <Muted>No sign-ins in this range.</Muted>}
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

      <SectionHeading>Devices</SectionHeading>
      <p className="-mt-3 text-[12px] text-ink-3">From the browsers of sessions started in the range.</p>
      <div className="grid gap-4 lg:grid-cols-3">
        <ChartCard title="Browsers"><BarList format={count} rows={devices('browser')} empty="No sessions in this range." /></ChartCard>
        <ChartCard title="Operating systems"><BarList format={count} rows={devices('os')} empty="No sessions in this range." /></ChartCard>
        <ChartCard title="Device types"><BarList format={count} rows={devices('device')} empty="No sessions in this range." /></ChartCard>
      </div>

      <ChartCard title="Retention by sign-up week" note="Share of each week's new accounts with map time in the weeks after (UTC, weeks start Monday)">
        {a.cohorts.length ? <CohortTable cohorts={a.cohorts} /> : <Muted>No sign-ups in this range to follow.</Muted>}
      </ChartCard>
    </>
  );
}
