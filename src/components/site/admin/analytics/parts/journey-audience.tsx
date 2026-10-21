'use client';

import { BarList } from '@/components/site/admin/charts/bar-list';
import { ChartCard } from '@/components/site/admin/charts/chart-card';
import { Heatmap } from '@/components/site/admin/charts/heatmap';
import { WorldDots } from '@/components/site/admin/charts/world-dots';
import { Muted } from '@/components/site/admin/parts/admin-parts';
import type { PageJourneys, VisitFilter } from '../analytics-types';
import { count, sum } from '../lib/format';
import { deviceLabel } from '../lib/journeys';
import { countryName, flag, placeShort } from '../lib/place';
import { DbIpCredit } from './place-label';
import { Pair } from './section-frame';

const visitsText = (n: number) => `${count(n)} visit${n === 1 ? '' : 's'}`;

/** When and where visits happen, on what, and whether they're new; countries and the new/returning split narrow the list below. */
export function JourneyAudience({ j, onPick }: { j: PageJourneys; onPick: (filter: VisitFilter) => void }) {
  const fresh = j.totals.visits - j.totals.returning;
  return (
    <>
      <Pair>
        <ChartCard title="Where visitors are" note="The town each visit's address points to; the address itself isn't kept">
          {j.points.length ? (
            <WorldDots label={`Where ${visitsText(sum(j.points.map(p => p.visits)))} came from`} format={visitsText}
              points={j.points.map(p => ({ latitude: p.latitude, longitude: p.longitude, value: p.visits, title: placeShort(p) }))} />
          ) : <Muted>No placed visits in this range.</Muted>}
          {j.points.length > 0 && <DbIpCredit />}
        </ChartCard>
        <ChartCard title="When they read" note="Visits by weekday and hour they began, in UTC">
          {j.hours.length ? <Heatmap cells={j.hours.map(h => ({ dow: h.dow, hour: h.hour, minutes: h.visits }))} format={visitsText} /> : <Muted>No visits in this range.</Muted>}
        </ChartCard>
      </Pair>
      <Pair>
        <ChartCard title="Countries" note="Click one to list its visits"
          table={j.countries.length ? { columns: ['Country', 'Visits'], rows: j.countries.map(c => [c.country ? countryName(c.country) : 'Not placed', c.visits]) } : null}>
          <BarList format={count} limit={10} empty="No visits in this range."
            rows={j.countries.map(c => ({
              key: c.country ?? '', value: c.visits,
              label: c.country
                ? <button type="button" onClick={() => onPick({ country: c.country! })} className="hover:underline">{flag(c.country)} {countryName(c.country)}</button>
                : 'Not placed',
            }))} />
        </ChartCard>
        <ChartCard title="Cities" table={j.cities.length ? { columns: ['City', 'Visits'], rows: j.cities.map(c => [placeShort(c), c.visits]) } : null}>
          <BarList format={count} limit={10} empty="No placed visits in this range."
            rows={j.cities.map(c => ({ key: `${c.country}|${c.region}|${c.city}`, label: <>{flag(c.country)} {placeShort(c)}</>, value: c.visits }))} />
        </ChartCard>
      </Pair>
      <Pair>
        <ChartCard title="New and returning" note="Returning: the browser read a page or used the map before this visit. Click one to list them">
          <BarList format={count} empty="No visits in this range."
            rows={[
              { key: 'new', value: fresh, label: <button type="button" onClick={() => onPick({ returning: 'new' })} className="hover:underline">New</button> },
              { key: 'returning', value: j.totals.returning, label: <button type="button" onClick={() => onPick({ returning: 'returning' })} className="hover:underline">Returning</button> },
            ].filter(r => r.value)} />
        </ChartCard>
        <ChartCard title="Devices">
          <BarList format={count} rows={j.devices.map(d => ({ key: d.device, label: deviceLabel(d.device), value: d.visits }))} empty="No visits in this range." />
        </ChartCard>
      </Pair>
      <Pair>
        <ChartCard title="Browsers">
          <BarList format={count} rows={j.browsers.map(b => ({ key: b.browser, label: b.browser, value: b.visits }))} empty="No visits in this range." />
        </ChartCard>
        <ChartCard title="Operating systems">
          <BarList format={count} rows={j.oses.map(o => ({ key: o.os, label: o.os, value: o.visits }))} empty="No visits in this range." />
        </ChartCard>
      </Pair>
      <ChartCard title="Campaigns" note="utm_source, ref or source on the link a visit opened with">
        <BarList format={count} rows={j.campaigns.map(c => ({ key: c.campaign, label: c.campaign, value: c.visits }))} empty="No tagged links in this range." />
      </ChartCard>
    </>
  );
}
