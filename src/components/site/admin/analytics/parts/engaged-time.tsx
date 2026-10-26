'use client';

import { useState } from 'react';
import { ChartCard } from '@/components/site/admin/charts/chart-card';
import { StatTile } from '@/components/site/admin/charts/stat-tile';
import { TABLE, TD, TH } from '@/components/site/admin/parts/admin-parts';
import type { EngagedStats, PageEngagedTime } from '../analytics-types';
import { count, duration, pct, plural } from '../lib/format';
import { pathText } from './journey-flow';
import { Tiles } from './section-frame';

const SHOWN = 12;

type Sort = 'views' | 'median' | 'short';

const time = (ms: number | null) => (ms == null ? '—' : duration(ms));
const shortShare = (s: EngagedStats) => (s.views ? s.short / s.views : 0);
const NUM = `${TD} whitespace-nowrap text-right font-mono tabular-nums`;

/**
 * How long people spent on the public pages while a page was on screen and in use, as each view reported it: overall, on
 * the page a visit began on, and per kind of page.
 */
export function EngagedTime({ e }: { e: PageEngagedTime }) {
  const [sort, setSort] = useState<Sort>('views');
  const [all, setAll] = useState(false);
  const rows = [...e.kinds].sort((a, b) =>
    sort === 'median' ? (b.medianMs ?? -1) - (a.medianMs ?? -1)
      : sort === 'short' ? shortShare(b) - shortShare(a) || b.views - a.views
        : b.views - a.views);
  const head = (key: Sort, label: string) => (
    <th className={`${TH} text-right`} aria-sort={sort === key ? 'descending' : 'none'}>
      <button type="button" onClick={() => setSort(key)} className={sort === key ? 'text-ink-1' : 'hover:text-ink-1'}>{label}{sort === key ? ' ↓' : ''}</button>
    </th>
  );
  const { landing } = e;

  if (!e.all.views) {
    return (
      <p className="text-[12px] text-ink-3">
        No engaged time in this range yet. Each public page sends it as the reader leaves or switches away, from the first view after it was added.
      </p>
    );
  }
  return (
    <>
      <Tiles>
        <StatTile label="Engaged per page view" value={time(e.all.medianMs)} sub={`median · average ${time(e.all.meanMs)}`} />
        <StatTile label="Views under 10 s" value={pct(e.all.short, e.all.views)} sub={`${count(e.all.short)} of ${plural(e.all.views, 'timed view')}`} />
        <StatTile label="On the landing page" value={time(landing.medianMs)}
          sub={`median · average ${time(landing.meanMs)} · ${pct(landing.short, landing.views)} under 10 s`} />
        <StatTile label="Landed and left" value={time(landing.left.medianMs)}
          sub={`${plural(landing.left.views, 'visit')} · ${time(landing.wentOn.medianMs)} when it went on`} />
      </Tiles>
      <ChartCard title="Engaged time by kind of page"
        note={<>
          Time each view was on screen with a scroll, click, key or touch in the last 30 s, a quick reload folded in; a star stands for any place,
          event or pair. Landed here is the median for views a visit began on. The map isn&apos;t timed here.
          {e.untimed > 0 && ` ${plural(e.untimed, 'page view')} in this range sent no time: from before it was measured, or the page never reported.`}
        </>}
        table={{
          columns: ['Kind of page', 'Timed views', 'Median', 'Average', 'Under 10 s', 'Landed here', 'Landed here (median)'],
          rows: e.kinds.map(k => [k.kind, k.views, time(k.medianMs), time(k.meanMs), pct(k.short, k.views), k.landings, time(k.landingMedianMs)]),
        }}>
        <div className="overflow-x-auto">
          <table className={TABLE}>
            <thead>
              <tr>
                <th className={TH}>Kind of page</th>
                {head('views', 'Views')}
                {head('median', 'Median')}
                <th className={`${TH} text-right`}>Average</th>
                {head('short', 'Under 10 s')}
                <th className={`${TH} text-right`}>Landed here</th>
              </tr>
            </thead>
            <tbody>
              {(all ? rows : rows.slice(0, SHOWN)).map(k => (
                <tr key={k.kind}>
                  <td className={`${TD} max-w-0 w-full truncate`}>{pathText(k.kind)}</td>
                  <td className={NUM}>{count(k.views)}</td>
                  <td className={NUM}>{time(k.medianMs)}</td>
                  <td className={NUM}>{time(k.meanMs)}</td>
                  <td className={NUM}>{pct(k.short, k.views)}</td>
                  <td className={`${NUM} ${k.landings ? '' : 'text-ink-3'}`} title={plural(k.landings, 'landing')}>{time(k.landingMedianMs)}</td>
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
      </ChartCard>
    </>
  );
}
