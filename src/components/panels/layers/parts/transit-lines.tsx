'use client';

import { useState, useSyncExternalStore } from 'react';
import { Button } from '@/components/ui/button';
import { cx, TRANSITION } from '@/components/ui/class-names';
import { useT } from '@/components/ui/use-t';
import { readableRoute, transitTitle } from '@/lib/feeds/transit/describe';
import { sameLine, setLineFocus, subscribeTransitLines, transitLinesState, type TransitLine } from '@/lib/feeds/transit/lines';
import { RAIL_MODES, TRANSIT_COLOR, TRANSIT_RAIL_COLOR } from '@/lib/feeds/transit/map-layers';

const SHOWN = 10;

type Row = Omit<TransitLine, 'vehicles'> & { vehicles: number | null };

/**
 * The lines running in view, under the layer while it is on: picking one draws its route and fades the rest.
 * The picked line stays on top, so it can be put back after panning away from it or zooming out.
 */
export function TransitLines() {
  const t = useT();
  const { lines, focus } = useSyncExternalStore(subscribeTransitLines, transitLinesState, transitLinesState);
  const [all, setAll] = useState(false);
  const picked: Row | null = focus && (lines?.find(l => sameLine(l, focus)) ?? { ...focus, vehicles: null });
  const rest = (lines ?? []).filter(l => !sameLine(l, focus));
  const shown = all ? rest : rest.slice(0, SHOWN - (picked ? 1 : 0));
  const operators = new Set(lines?.map(l => l.operator)).size > 1;

  const row = (l: Row) => {
    const on = sameLine(focus, l);
    return (
      <button key={`${l.feed}\n${l.route}`} type="button" aria-pressed={on}
        onClick={() => setLineFocus(on ? null : { feed: l.feed, route: l.route, mode: l.mode, trips: l.trips })}
        className={cx('-mx-1.5 flex min-h-7 items-center gap-2 rounded-control px-1.5 text-left hover:bg-surface-2', on && 'bg-surface-2', TRANSITION)}>
        <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ background: l.mode && RAIL_MODES.includes(l.mode) ? TRANSIT_RAIL_COLOR : TRANSIT_COLOR }} />
        <span className={cx('min-w-0 flex-1 truncate text-small', on ? 'text-ink-1' : 'text-ink-2', !readableRoute(l.route) && 'font-mono')}>
          {readableRoute(l.route) ? transitTitle({ route: l.route, mode: l.mode }, t) : l.route}
          {operators && l.operator && <span className="text-ink-3"> · {l.operator}</span>}
        </span>
        <span className="shrink-0 font-mono text-small tabular-nums text-ink-2">{l.vehicles?.toLocaleString(t.intl) ?? '—'}</span>
      </button>
    );
  };

  return (
    <div className="mb-2 ml-2 flex flex-col border-l border-line py-1 pl-[19px]">
      {(picked || rest.length > 0) && <p className="pb-1 text-meta font-medium text-ink-3">{t('Lines in view')}</p>}
      {picked && row(picked)}
      {shown.map(row)}
      {!rest.length && <p className="py-1 text-small text-ink-3">{lines ? t('No lines running in view') : t('Zoom in to a city to list its lines')}</p>}
      {shown.length < rest.length || all ? (
        <Button variant="ghost" size="sm" className="-mx-1.5 mt-1 self-start" onClick={() => setAll(!all)}>
          {all ? t('Show fewer') : t('Show all {n} lines', { n: (lines ?? []).length })}
        </Button>
      ) : null}
    </div>
  );
}
