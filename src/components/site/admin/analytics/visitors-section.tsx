'use client';

import { useRef, useState } from 'react';
import type { AnalyticsPages, AnalyticsVisitors, VisitFilter } from './analytics-types';
import type { AnalyticsQuery } from './lib/use-analytics-data';
import { ActivityLog, type LogView } from './parts/activity-log';
import { JourneyAudience } from './parts/journey-audience';
import { JourneyFlow } from './parts/journey-flow';
import { JourneyPages } from './parts/journey-pages';
import { PageDetail } from './parts/page-detail';
import { SectionFrame, SectionHeading } from './parts/section-frame';
import { VisitorsMore } from './parts/visitors-more';
import { VisitorsSummary } from './parts/visitors-summary';

/**
 * Everyone who came, readers and map users together, from the visit log. Picking a source, page, country or outcome
 * narrows the visits list at the bottom. `range` is the page's ?days=… or ?hours=…; `hours` is set for the latter.
 */
export function VisitorsSection({ pages, visitors, range, hours }: {
  pages: AnalyticsQuery<AnalyticsPages>; visitors: AnalyticsQuery<AnalyticsVisitors>; range: string; hours: number | null;
}) {
  const [filter, setFilter] = useState<VisitFilter>({});
  const [view, setView] = useState<LogView>('visits');
  const list = useRef<HTMLDivElement>(null);
  const pick = (next: VisitFilter) => {
    setFilter(next);
    setView('visits');
    list.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <>
      <p className="text-[12px] text-ink-3">
        Every browser that opened a public page or the map, signed in or not. A visit ends after half an hour without a view; crawlers aren&apos;t
        counted. Accounts are under Audience.
      </p>
      <SectionFrame query={pages}>
        {p => (
          <>
            <VisitorsSummary j={p.journeys} hours={hours} />
            <SectionHeading>How they arrived</SectionHeading>
            <JourneyFlow j={p.journeys} onPick={pick} />
            <SectionHeading>What they read</SectionHeading>
            <JourneyPages j={p.journeys} onPick={pick} />
            <SectionHeading>Where and when</SectionHeading>
            <JourneyAudience j={p.journeys} onPick={pick} />
            <VisitorsMore v={visitors.data} p={p} />
          </>
        )}
      </SectionFrame>
      <div ref={list} className="flex scroll-mt-4 flex-col gap-4">
        {filter.page && <PageDetail range={range} path={filter.page} onClose={() => setFilter({ ...filter, page: undefined })} />}
        <ActivityLog range={range} filter={filter} onFilter={setFilter} view={view} onView={setView} />
      </div>
    </>
  );
}
