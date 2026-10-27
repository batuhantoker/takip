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
import { localWeekHours } from '../lib/zone';
import { DbIpCredit } from './place-label';
import { Pair } from './section-frame';
import { TabbedCard } from './tabbed-card';

const visitsText = (n: number) => `${count(n)} visit${n === 1 ? '' : 's'}`;
const EMPTY = 'No visits in this range.';

/** Where visits come from on the globe, on what, and when; countries and new or returning narrow the list below. */
export function JourneyAudience({ j, onPick }: { j: PageJourneys; onPick: (filter: VisitFilter) => void }) {
  const fresh = j.totals.visits - j.totals.returning;
  const pickable = (text: string, filter: VisitFilter) => <button type="button" onClick={() => onPick(filter)} className="hover:underline">{text}</button>;
  return (
    <>
      <Pair>
        <ChartCard title="On the map" note="The town each visit's address points to; the address itself isn't kept">
          {j.points.length ? (
            <WorldDots label={`Where ${visitsText(sum(j.points.map(p => p.visits)))} came from`} format={visitsText}
              points={j.points.map(p => ({
                latitude: p.latitude, longitude: p.longitude, value: p.visits, title: placeShort(p),
                label: p.city ?? (p.country ? countryName(p.country) : undefined),
              }))} />
          ) : <Muted>No placed visits in this range.</Muted>}
          {j.points.length > 0 && <DbIpCredit />}
        </ChartCard>
        <TabbedCard title="Places" tabs={[
          { id: 'countries', label: 'Countries', note: 'Click one to list its visits', body: (
            <BarList format={count} limit={10} empty={EMPTY}
              rows={j.countries.map(c => ({
                key: c.country ?? '', value: c.visits,
                label: c.country ? pickable(`${flag(c.country)} ${countryName(c.country)}`, { country: c.country }) : 'Not placed',
              }))} />
          ) },
          { id: 'cities', label: 'Cities', body: (
            <BarList format={count} limit={10} empty="No placed visits in this range."
              rows={j.cities.map(c => ({ key: `${c.country}|${c.region}|${c.city}`, label: <>{flag(c.country)} {placeShort(c)}</>, value: c.visits }))} />
          ) },
        ]} />
      </Pair>
      <Pair>
        <TabbedCard title="Devices" tabs={[
          { id: 'device', label: 'Type', body: <BarList format={count} rows={j.devices.map(d => ({ key: d.device, label: deviceLabel(d.device), value: d.visits }))} empty={EMPTY} /> },
          { id: 'browser', label: 'Browser', body: <BarList format={count} rows={j.browsers.map(b => ({ key: b.browser, label: b.browser, value: b.visits }))} empty={EMPTY} /> },
          { id: 'os', label: 'System', body: <BarList format={count} rows={j.oses.map(o => ({ key: o.os, label: o.os, value: o.visits }))} empty={EMPTY} /> },
          { id: 'returning', label: 'New or back', note: 'Back: the browser read a page or used the map before. Click one to list them', body: (
            <BarList format={count} empty={EMPTY}
              rows={[
                { key: 'new', value: fresh, label: pickable('New', { returning: 'new' }) },
                { key: 'returning', value: j.totals.returning, label: pickable('Returning', { returning: 'returning' }) },
              ].filter(r => r.value)} />
          ) },
        ]} />
        <ChartCard title="When they come" note={`Visits by weekday and the hour they began, ${localWeekHours([]).zone}`}>
          {j.hours.length ? <Heatmap cells={j.hours.map(h => ({ dow: h.dow, hour: h.hour, minutes: h.visits }))} format={visitsText} /> : <Muted>{EMPTY}</Muted>}
        </ChartCard>
      </Pair>
    </>
  );
}
