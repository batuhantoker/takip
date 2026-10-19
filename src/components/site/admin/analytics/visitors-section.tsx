import { BarList } from '@/components/site/admin/charts/bar-list';
import { ChartCard } from '@/components/site/admin/charts/chart-card';
import { CohortTable } from '@/components/site/admin/charts/cohort-table';
import { StackedBars } from '@/components/site/admin/charts/stacked-bars';
import { StatTile } from '@/components/site/admin/charts/stat-tile';
import { TimeSeries } from '@/components/site/admin/charts/time-series';
import { WorldDots } from '@/components/site/admin/charts/world-dots';
import { Muted } from '@/components/site/admin/parts/admin-parts';
import type { AnalyticsVisitors } from './analytics-types';
import { DIRECT_ARRIVAL } from './lib/features';
import { count, longDay, minutes, pct, shortDay, sinceIndex, sum, weekDelta } from './lib/format';
import { placeText } from './lib/place';
import { ink, NEUTRAL } from './lib/series';
import type { AnalyticsQuery } from './lib/use-analytics-data';
import { DbIpCredit, PlaceLabel } from './parts/place-label';
import { Pair, SectionFrame, SectionHeading, Tiles } from './parts/section-frame';
import VisitorsList from './parts/visitors-list';

export function VisitorsSection({ query, days }: { query: AnalyticsQuery<AnalyticsVisitors>; days: number }) {
  return (
    <>
      <p className="text-[12px] text-ink-3">
        Browsers that keep a visitor id and send it with the map&apos;s minute tick. Minutes here are time spent signed out; an account&apos;s own time is
        under Users. Audience&apos;s daily visitor counts also include browsers that block storage, so they can run higher.
      </p>
      <SectionFrame query={query}>{v => <Visitors v={v} />}</SectionFrame>
      <VisitorsList days={days} />
    </>
  );
}

/** Visitor ids began on one day; before it every series is zero by absence, not by fact. */
function CollectingIds({ since, first }: { since: string | null; first?: string }) {
  if (!since) return <p className="text-[12px] text-ink-3">No visitor ids recorded yet. A browser gets one the first time it opens the map.</p>;
  if (!first || since > first) return <p className="text-[12px] text-ink-3">Collecting since {longDay(since)}; earlier days have no visitor ids.</p>;
  return null;
}

function Visitors({ v }: { v: AnalyticsVisitors }) {
  const { totals, daily } = v;
  const days = daily.map(d => d.day);
  const columns = daily.map(d => ({ key: d.day, label: shortDay(d.day) }));
  const from = sinceIndex(daily, v.since);
  const series = (key: keyof (typeof daily)[number]) => daily.map(d => d[key] as number);
  const conversion = (visitors: number, signedIn: number) => `${count(signedIn)} signed in later · ${pct(signedIn, visitors)}`;
  const devices = (kind: 'browser' | 'os' | 'device') =>
    v.devices.filter(d => d.kind === kind).sort((x, y) => y.visitors - x.visitors).map(d => ({ key: d.name, label: d.name, value: d.visitors }));
  const topReferrer = v.referrers.find(r => r.referrer);

  return (
    <>
      <CollectingIds since={v.since} first={days[0]} />
      <Tiles>
        <StatTile label="Visitors" value={count(totals.visitors)} sub={`${count(totals.new)} new in ${daily.length} days`} trend={series('visitors')} delta={weekDelta(series('visitors'), from)} />
        <StatTile label="New" value={count(totals.new)} sub="First seen in the range" trend={series('new')} delta={weekDelta(series('new'), from)} />
        <StatTile label="Returning" value={count(totals.returning)} sub={`${pct(totals.returning, totals.visitors)} of visitors`} trend={series('returning')} />
        <StatTile label="Signed in later" value={count(totals.signedIn)} sub={`${pct(totals.signedIn, totals.visitors)} of visitors`} trend={series('signedIn')} />
        <StatTile label="Map time signed out" value={minutes(totals.minutes)} trend={series('minutes')} delta={weekDelta(series('minutes'), from)} />
        <StatTile label="Per visitor-day" value={minutes(totals.avgMinutesPerVisitorDay)} sub="Signed-out minutes" />
        <StatTile label="Hit the time limit" value={count(totals.hitWall)} sub={`${pct(totals.hitWall, totals.visitors)} of visitors`} />
        <StatTile label="Top referrer" value={topReferrer?.referrer ?? 'none'} sub={topReferrer ? `${count(topReferrer.visitors)} visitors` : 'Every arrival was direct or hidden'} />
      </Tiles>

      <Pair>
        <ChartCard
          title="New and returning per day"
          note="New: first seen that day. Returning: seen before."
          table={{ columns: ['Day', 'New', 'Returning', 'Signed in'], rows: [...daily].reverse().map(d => [d.day, d.new, d.returning, d.signedIn]) }}
        >
          {sum(series('visitors')) ? (
            <StackedBars
              label="New and returning visitors per day"
              columns={columns}
              series={[
                { key: 'new', label: 'New', color: ink(0), values: series('new') },
                { key: 'returning', label: 'Returning', color: ink(1), values: series('returning') },
              ]}
            />
          ) : <Muted>No visitors in this range.</Muted>}
        </ChartCard>
        <ChartCard title="Map time signed out per day" table={{ columns: ['Day', 'Minutes'], rows: [...daily].reverse().map(d => [d.day, d.minutes]) }}>
          {sum(series('minutes')) ? (
            <TimeSeries label="Visitors' signed-out map minutes per day" days={days} format={minutes} series={[{ key: 'minutes', label: 'Minutes', color: NEUTRAL, values: series('minutes') }]} />
          ) : <Muted>No signed-out map time in this range.</Muted>}
        </ChartCard>
      </Pair>

      <SectionHeading>Where they came from</SectionHeading>
      <p className="-mt-3 text-[12px] text-ink-3">How visitors first seen in the range arrived, and how many of them later signed in on that browser.</p>
      <Pair>
        <ChartCard title="Referrers" note="The other site that sent their first visit">
          <BarList
            format={count}
            rows={v.referrers.map(r => ({ key: r.referrer ?? '', label: r.referrer ?? DIRECT_ARRIVAL, value: r.visitors, detail: conversion(r.visitors, r.signedIn) }))}
            empty="No new visitors in this range."
          />
        </ChartCard>
        <ChartCard title="Campaigns" note="utm_source on the first visit">
          <BarList format={count} rows={v.campaigns.map(c => ({ key: c.source, label: c.source, value: c.visitors, detail: conversion(c.visitors, c.signedIn) }))} empty="No campaign links in this range." />
        </ChartCard>
      </Pair>
      <ChartCard title="Landing pages" note="Where the first visit landed; only campaign and share parameters are kept">
        <BarList format={count} limit={10} rows={v.landings.map(l => ({ key: l.landing, label: <span className="font-mono text-[12px]">{l.landing}</span>, value: l.visitors }))} empty="No new visitors in this range." />
      </ChartCard>

      <SectionHeading>Where they are</SectionHeading>
      <p className="-mt-3 text-[12px] text-ink-3">Where visitors active in the range used the map from, placed from their address; one visitor can be in several places.</p>
      <Pair>
        <ChartCard title="Countries" table={v.countries.length ? { columns: ['Country', 'Visitors', 'Signed in later'], rows: v.countries.map(c => [placeText({ country: c.country }), c.visitors, c.signedIn]) } : null}>
          <BarList
            format={count}
            rows={v.countries.map(c => ({ key: c.country, label: <PlaceLabel place={{ country: c.country }} />, value: c.visitors, detail: conversion(c.visitors, c.signedIn) }))}
            empty="No placed visitors in this range."
          />
        </ChartCard>
        <ChartCard title="Cities" table={v.cities.length ? { columns: ['City', 'Visitors'], rows: v.cities.map(c => [placeText(c), c.visitors]) } : null}>
          <BarList format={count} limit={10} rows={v.cities.map(c => ({ key: `${c.country}|${c.region}|${c.city}`, label: <PlaceLabel place={c} />, value: c.visitors }))} empty="No placed visitors in this range." />
        </ChartCard>
      </Pair>
      <ChartCard
        title="On the map"
        note="One dot per place, sized by how many visitors were last seen there: their shared location where they gave one, else their IP's guess"
        table={v.points.length ? { columns: ['Latitude', 'Longitude', 'Visitors'], rows: [...v.points].sort((a, b) => b.visitors - a.visitors).map(p => [p.latitude.toFixed(2), p.longitude.toFixed(2), p.visitors]) } : null}
      >
        {v.points.length ? (
          <WorldDots
            label={`Where ${count(sum(v.points.map(p => p.visitors)))} visitors were last seen`}
            format={n => `${count(n)} visitor${n === 1 ? '' : 's'}`}
            points={v.points.map(p => ({ latitude: p.latitude, longitude: p.longitude, value: p.visitors }))}
          />
        ) : <Muted>No placed visitors in this range.</Muted>}
      </ChartCard>
      <DbIpCredit />

      <SectionHeading>Devices</SectionHeading>
      <div className="grid gap-4 lg:grid-cols-3">
        <ChartCard title="Browsers"><BarList format={count} rows={devices('browser')} empty="No visitors in this range." /></ChartCard>
        <ChartCard title="Operating systems"><BarList format={count} rows={devices('os')} empty="No visitors in this range." /></ChartCard>
        <ChartCard title="Device types"><BarList format={count} rows={devices('device')} empty="No visitors in this range." /></ChartCard>
      </div>

      <ChartCard title="Retention by first-seen week" note="Share of each week's new visitors with signed-out map time in the weeks after (UTC, weeks start Monday)">
        {v.cohorts.some(c => c.size) ? <CohortTable cohorts={v.cohorts} cohortLabel="First seen (week of)" sizeLabel="Visitors" /> : <Muted>No visitors to follow yet.</Muted>}
      </ChartCard>
    </>
  );
}
