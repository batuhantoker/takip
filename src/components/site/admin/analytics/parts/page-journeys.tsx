'use client';

import { StatTile } from '@/components/site/admin/charts/stat-tile';
import type { PageJourneys, VisitFilter } from '../analytics-types';
import { count, duration, longDay, pct } from '../lib/format';
import { JourneyAudience } from './journey-audience';
import { JourneyFlow } from './journey-flow';
import { JourneyPages } from './journey-pages';
import { SectionHeading, Tiles } from './section-frame';

/** Visits from the view log: where they came from, what they read, when and from where. Picking anything narrows the recent visits. */
export function PageJourneys({ j, first, onPick }: { j: PageJourneys; first: string | undefined; onPick: (filter: VisitFilter) => void }) {
  const { totals } = j;
  const fromPage = totals.visits - totals.landedOnMap;
  return (
    <>
      {!j.since
        ? <p className="text-[12px] text-ink-3">No visits logged yet. Each view and map opening is logged from the first one after this was added.</p>
        : first && j.since > first && <p className="text-[12px] text-ink-3">Visits logged since {longDay(j.since)}; the counts above go back further.</p>}
      <Tiles>
        <StatTile label="Visits" value={count(totals.visits)} sub={`${count(totals.views)} views · ${totals.avgSteps.toFixed(1)} steps each`} />
        <StatTile label="Went on to the map" value={count(totals.toMap)} sub={`${pct(totals.toMap, fromPage)} of visits that began on a page`} />
        <StatTile label="Left after one page" value={count(totals.left)} sub={`${pct(totals.left, totals.visits)} of visits`} />
        <StatTile label="Returning" value={count(totals.returning)} sub={`${pct(totals.returning, totals.visits)} of visits`} />
        <StatTile label="Median visit" value={totals.medianMs == null ? '—' : duration(totals.medianMs)} sub="First view to last, of visits with two or more" />
      </Tiles>
      <JourneyFlow j={j} onPick={onPick} />
      <SectionHeading>What they read</SectionHeading>
      <JourneyPages j={j} onPick={onPick} />
      <SectionHeading>Who they are</SectionHeading>
      <JourneyAudience j={j} onPick={onPick} />
    </>
  );
}
