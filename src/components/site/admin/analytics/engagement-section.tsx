'use client';

import Link from 'next/link';
import { tabHref } from '@/components/site/admin/lib/areas';
import { useState, type ReactNode } from 'react';
import { ChartCard } from '@/components/site/admin/charts/chart-card';
import { Heatmap } from '@/components/site/admin/charts/heatmap';
import { Meter } from '@/components/site/admin/charts/meter';
import { StatTile } from '@/components/site/admin/charts/stat-tile';
import { TimeSeries } from '@/components/site/admin/charts/time-series';
import { Muted } from '@/components/site/admin/parts/admin-parts';
import type { AnalyticsEngagement } from './analytics-types';
import { engagementFindings, MIN_PEOPLE, type Finding, type UseTab } from './lib/engagement-findings';
import { featureLabel, featureLongLabel } from './lib/features';
import { count, minutes, pct, plural } from './lib/format';
import { ink, NEUTRAL } from './lib/series';
import type { AnalyticsQuery } from './lib/use-analytics-data';
import { weekHourTable } from './lib/zone';
import { EngagementFindings } from './parts/engagement-findings';
import { EngagementFunnel, EngagementStay } from './parts/engagement-funnel';
import { EntryPoints } from './parts/entry-points';
import { UseCard } from './parts/feature-cards';
import { More } from './parts/more';
import { CollectingNote, Pair, SectionFrame, Tiles } from './parts/section-frame';
import { TopUsersTable } from './parts/top-users-table';

export function EngagementSection({ query }: { query: AnalyticsQuery<AnalyticsEngagement> }) {
  return <SectionFrame query={query}>{e => <Engagement e={e} />}</SectionFrame>;
}

/** Wraps a card so a finding can scroll to it. */
const Anchor = ({ id, children }: { id: string; children: ReactNode }) => <div id={id} className="min-w-0 scroll-mt-16">{children}</div>;

/** "40%" with enough people to mean something; the count until then. */
const share = (n: number, of: number) => (of >= MIN_PEOPLE ? pct(n, of) : count(n));

/** What draws people to the map and how long they stay: findings, four numbers, then the cards they come from. */
function Engagement({ e }: { e: AnalyticsEngagement }) {
  const [tab, setTab] = useState<UseTab>('actions');
  const go = (f: Finding) => {
    if (f.tab) setTab(f.tab);
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    document.getElementById(f.target)?.scrollIntoView({ behavior: still ? 'auto' : 'smooth', block: 'start' });
  };
  const { people, minutes: total, medianMinutes, leftWithinMinute } = e.totals;
  const wall = e.features.find(f => f.feature === 'view:wall');
  const devices = (['device:desktop', 'device:mobile'] as const).map((f, i) => ({
    label: featureLabel(f), value: e.features.find(x => x.feature === f)?.people ?? 0, color: ink(i),
  }));
  const week = weekHourTable(e.hours);

  return (
    <>
      <CollectingNote since={e.since} first={e.daily[0]?.day} />
      <EngagementFindings items={engagementFindings(e)} onGo={go} />

      <Tiles>
        <StatTile label="People on the map" value={count(people)} sub={`${plural(e.totals.visitors, 'browser')} · ${plural(e.totals.accounts, 'account')}`}
          trend={e.daily.map(d => d.people)} />
        <StatTile label="Median time a person" value={medianMinutes != null && medianMinutes <= 1 ? '<1 min' : minutes(medianMinutes)}
          sub={`${minutes(total)} in all${wall?.minutes ? `, ${minutes(wall.minutes)} more on the wall` : ''}`} />
        <StatTile label="Left within a minute" value={share(leftWithinMinute, people)} sub={`${count(leftWithinMinute)} of ${count(people)} people`} />
        <StatTile label="Came back another day" value={share(e.funnel.cameBack, people)} sub={`${count(e.funnel.cameBack)} of ${count(people)} people`} />
      </Tiles>

      <Pair>
        <Anchor id="engagement-funnel"><EngagementFunnel e={e} /></Anchor>
        <Anchor id="engagement-stay"><EngagementStay e={e} /></Anchor>
      </Pair>
      <Pair>
        <Anchor id="engagement-entries"><EntryPoints e={e} /></Anchor>
        <Anchor id="engagement-use"><UseCard e={e} tab={tab} onTab={setTab} /></Anchor>
      </Pair>

      <ChartCard
        title="Most active accounts"
        note={`By map minutes over the last ${e.days} days`}
        actions={<Link href={tabHref('accounts', 'people')} className="text-[12px] text-accent hover:underline">Every account</Link>}
      >
        {e.topUsers.length ? <TopUsersTable users={e.topUsers} label={featureLongLabel} /> : <Muted>No account has map time in this range yet.</Muted>}
      </ChartCard>

      <More id="engagement-patterns" title="Patterns" holds="People per day, when in the week, and on which device">
        <ChartCard title="People on the map per day" note="Each person once a day, UTC days"
          table={{ columns: ['Day', 'People', 'Minutes'], rows: [...e.daily].reverse().map(d => [d.day, d.people, d.minutes]) }}>
          {people ? (
            <TimeSeries label="People on the map per day" days={e.daily.map(d => d.day)} format={count}
              series={[{ key: 'people', label: 'People', color: NEUTRAL, values: e.daily.map(d => d.people) }]} />
          ) : <Muted>No map time in this range yet.</Muted>}
        </ChartCard>
        <Pair>
          <ChartCard title="When people use the map" note={`Map minutes by weekday and hour (${week.zone}), admins left out`} table={week}>
            {e.hours.length ? <Heatmap cells={e.hours} /> : <Muted>No map time in this range yet.</Muted>}
          </ChartCard>
          <ChartCard title="Devices" note="People on the map by device; someone on both counts in each">
            {people ? <Meter format={count} total={devices.reduce((n, d) => n + d.value, 0)} parts={devices} /> : <Muted>No map time in this range yet.</Muted>}
          </ChartCard>
        </Pair>
      </More>
    </>
  );
}
