'use client';

import { useId, useState } from 'react';
import { ChartCard } from '@/components/site/admin/charts/chart-card';
import { Segmented } from '@/components/ui/segmented';
import type { AnalyticsEngagement, EngagementEntry } from '../analytics-types';
import { count, minutes, pct } from '../lib/format';
import { pathLabel } from '../lib/journeys';
import { NEUTRAL } from '../lib/series';

type Level = 'sections' | 'pages';
const LIMIT = 8;

/** Where each person first came in, and how many of them went on to use the map and for how long. */
export function EntryPoints({ e }: { e: AnalyticsEngagement }) {
  const id = useId();
  const [level, setLevel] = useState<Level>('sections');
  const [all, setAll] = useState(false);
  const rows = e.entries[level];
  const shown = all ? rows : rows.slice(0, LIMIT);
  return (
    <ChartCard
      title="Where people came in"
      note="Each person's first page in the range, or the map itself, with how many came in there; the bar and share are those who went on to the map. Places, events and pairs are starred."
      actions={<Segmented size="sm" id={id} label="Group landings by" value={level} onChange={v => { setLevel(v); setAll(false); }}
        options={[{ value: 'sections', label: 'Sections' }, { value: 'pages', label: 'Pages' }]} />}
      table={rows.length ? {
        columns: ['Came in on', 'People', 'Used the map', 'Median map minutes'],
        rows: rows.map(r => [pathLabel(r.page), r.people, r.openedMap, r.medianMapMinutes ?? '—']),
      } : null}
    >
      {rows.length ? (
        <div className="flex flex-col gap-3">
          <ul className="flex flex-col gap-2.5">{shown.map(r => <EntryRow key={r.page} row={r} />)}</ul>
          {rows.length > LIMIT && (
            <button type="button" onClick={() => setAll(v => !v)} className="self-start text-[12px] text-accent hover:underline">
              {all ? 'Show fewer' : `Show all ${rows.length}`}
            </button>
          )}
        </div>
      ) : <p className="text-[12px] text-ink-3">No arrivals logged in this range.</p>}
    </ChartCard>
  );
}

function EntryRow({ row }: { row: EngagementEntry }) {
  const share = row.people ? row.openedMap / row.people : 0;
  return (
    <li className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between gap-3 text-[12px]">
        <span className={`min-w-0 truncate text-ink-1 ${row.page === '/' ? '' : 'font-mono'}`}>{pathLabel(row.page)}</span>
        <span className="shrink-0 font-mono tabular-nums text-ink-1">
          {count(row.people)}
          <span className="ml-2 inline-block w-10 text-right text-ink-3">{pct(row.openedMap, row.people)}</span>
        </span>
      </div>
      <div className="h-1.5 rounded-[3px] bg-surface-2" aria-hidden>
        <div className="h-full rounded-[3px]" style={{ width: `${share * 100}%`, background: NEUTRAL }} />
      </div>
      <div className="text-[11px] text-ink-3">
        {row.openedMap
          ? `${count(row.openedMap)} went on to the map · median ${minutes(row.medianMapMinutes)} there`
          : 'None used the map'}
      </div>
    </li>
  );
}
