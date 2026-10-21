'use client';

import { useState } from 'react';
import { BarList } from '@/components/site/admin/charts/bar-list';
import { ChartCard } from '@/components/site/admin/charts/chart-card';
import { TABLE, TD, TH } from '@/components/site/admin/parts/admin-parts';
import type { PageJourneys, VisitFilter } from '../analytics-types';
import { count, duration, pct } from '../lib/format';
import { pathLabel } from '../lib/journeys';
import { pathText } from './journey-flow';
import { Pair } from './section-frame';

const SHOWN = 12;

type Sort = 'visits' | 'exits' | 'time';

/** Each page's visits, how many began and ended there, and how long readers stayed before the next step; then page to page. */
export function JourneyPages({ j, onPick }: { j: PageJourneys; onPick: (filter: VisitFilter) => void }) {
  const [sort, setSort] = useState<Sort>('visits');
  const [all, setAll] = useState(false);
  const exitRate = (p: PageJourneys['pages'][number]) => (p.visits ? p.exits / p.visits : 0);
  const rows = [...j.pages].sort((a, b) =>
    sort === 'exits' ? exitRate(b) - exitRate(a) || b.visits - a.visits
      : sort === 'time' ? (b.medianMs ?? -1) - (a.medianMs ?? -1)
        : b.visits - a.visits);
  const head = (key: Sort, label: string) => (
    <th className={`${TH} text-right`} aria-sort={sort === key ? 'descending' : 'none'}>
      <button type="button" onClick={() => setSort(key)} className={sort === key ? 'text-ink-1' : 'hover:text-ink-1'}>{label}{sort === key ? ' ↓' : ''}</button>
    </th>
  );

  return (
    <Pair>
      <ChartCard title="Pages: time and exits"
        note="Time is until the next step of the same visit, so a visit's last page has none. Click a page for where its readers came from and went."
        table={j.pages.length ? { columns: ['Page', 'Visits', 'Landed here', 'Left from here', 'Median time'], rows: j.pages.map(p => [pathLabel(p.path), p.visits, p.landings, p.exits, p.medianMs == null ? '—' : duration(p.medianMs)]) } : null}>
        {j.pages.length ? (
          <div className="overflow-x-auto">
            <table className={TABLE}>
              <thead>
                <tr>
                  <th className={TH}>Page</th>
                  {head('visits', 'Visits')}
                  {head('exits', 'Left from here')}
                  {head('time', 'Median time')}
                </tr>
              </thead>
              <tbody>
                {(all ? rows : rows.slice(0, SHOWN)).map(p => (
                  <tr key={p.path}>
                    <td className={`${TD} max-w-0 w-full`}>
                      <button type="button" onClick={() => onPick({ page: p.path })} className="block max-w-full truncate text-left hover:underline">{pathText(p.path)}</button>
                    </td>
                    <td className={`${TD} text-right font-mono tabular-nums`} title={`${count(p.landings)} began here`}>{count(p.visits)}</td>
                    <td className={`${TD} text-right font-mono tabular-nums`}>{pct(p.exits, p.visits)}</td>
                    <td className={`${TD} whitespace-nowrap text-right font-mono tabular-nums`}>{p.medianMs == null ? '—' : duration(p.medianMs)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length > SHOWN && (
              <button type="button" onClick={() => setAll(v => !v)} className="mt-2 text-[12px] text-accent hover:underline">
                {all ? 'Show fewer' : `Show all ${rows.length}`}
              </button>
            )}
          </div>
        ) : <p className="text-[12px] text-ink-3">No visits in this range.</p>}
      </ChartCard>
      <ChartCard title="Page to page" note="Each step inside a visit, from one page (or the map) to the next"
        table={j.steps.length ? { columns: ['From', 'To', 'Visits'], rows: j.steps.map(s => [pathLabel(s.from), pathLabel(s.to), s.visits]) } : null}>
        <BarList format={count} limit={12} share={false} empty="No visit went past its first page yet."
          rows={j.steps.map(s => ({ key: `${s.from}>${s.to}`, label: <>{pathText(s.from)} <span className="text-ink-3">→</span> {pathText(s.to)}</>, value: s.visits }))} />
      </ChartCard>
    </Pair>
  );
}
