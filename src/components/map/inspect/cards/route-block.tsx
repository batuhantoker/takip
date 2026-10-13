'use client';

import { useState } from 'react';
import type { Airport } from '@/lib/flights/watch';
import { clockTime } from '@/components/map/inspect/format';
import { Note } from '@/components/map/inspect/parts/inspect-card';
import type { RouteState } from '@/components/map/inspect/types';

function End({ ap, align }: { ap: Airport | null; align: 'left' | 'right' }) {
  return (
    <div className={align === 'right' ? 'min-w-0 text-right' : 'min-w-0'}>
      <div className="font-mono text-[15px]/5 font-medium text-ink-1 tabular-nums">{ap ? ap.iata || ap.icao : '—'}</div>
      <div className="truncate text-[11px]/[14px] text-ink-3">{ap?.city || (ap ? ap.icao : 'Unknown')}</div>
    </div>
  );
}

/** From → to, with progress when the schedule agrees with what the aircraft is doing. */
export function RouteBlock({ route }: { route: RouteState }) {
  const [now] = useState(() => Date.now());
  if (route.status === 'loading') return <Note>Finding the route…</Note>;
  if (route.status !== 'found') {
    const tail = route.tracked ? ' · flown track on the map' : '';
    const text = route.status === 'mismatch' ? 'The schedule for this callsign is a different leg'
      : route.status === 'unavailable' ? 'Route lookup unavailable' : 'No scheduled route';
    return <Note>{text}{tail}</Note>;
  }

  const { origin, destination, schedule, landed } = route;
  const pct = schedule?.progress != null ? Math.round(schedule.progress * 100) : null;
  const dep = clockTime(schedule?.departureTime);
  const arr = clockTime(schedule?.arrivalTime);
  const past = (iso?: string | null) => !!iso && Date.parse(iso) < now;
  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <End ap={origin} align="left" />
        <span aria-hidden className="text-[12px] text-ink-3">→</span>
        <End ap={destination} align="right" />
      </div>
      {pct != null && (
        <div className="h-0.5 overflow-hidden rounded-full bg-surface-3" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Flight progress">
          <div className="h-full rounded-full bg-ink-2" style={{ width: `${pct}%` }} />
        </div>
      )}
      <div className="flex justify-between gap-2 text-[11px]/[14px] text-ink-3">
        <span>{dep && <>{past(schedule?.departureTime) ? 'Departed' : 'Departs'} <span className="font-mono tabular-nums text-ink-2">{dep}</span></>}</span>
        {pct != null && <span className="font-mono tabular-nums">{pct}%{schedule?.totalDistanceKm ? ` · ${schedule.totalDistanceKm.toLocaleString()} km` : ''}</span>}
        <span>{landed ? 'Landed' : arr ? <>{past(schedule?.arrivalTime) ? 'Arrived' : 'Arrives'} <span className="font-mono tabular-nums text-ink-2">{arr}</span></> : !schedule ? 'Seen on the track, not scheduled' : ''}</span>
      </div>
    </div>
  );
}
