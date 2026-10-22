'use client';

import { useId } from 'react';
import { Segmented } from '@/components/ui/segmented';
import type { VisitFilter } from '../analytics-types';
import { RecentVisits } from './recent-visits';
import VisitorsList from './visitors-list';

export type LogView = 'visits' | 'browsers';

/** One list, two ways in: each visit with its trail of pages, or each map browser with its time and a page of its own. */
export function ActivityLog({ range, filter, onFilter, view, onView }: {
  range: string; filter: VisitFilter; onFilter: (f: VisitFilter) => void; view: LogView; onView: (view: LogView) => void;
}) {
  const id = useId();
  const tabs = (
    <Segmented size="sm" semantics="tabs" id={id} label="Activity" value={view} onChange={onView} className="self-start"
      options={[{ value: 'visits', label: 'Visits' }, { value: 'browsers', label: 'Map browsers' }]} />
  );
  return view === 'visits'
    ? <RecentVisits range={range} filter={filter} onFilter={onFilter} tabs={tabs} />
    : <VisitorsList range={range} tabs={tabs} />;
}
