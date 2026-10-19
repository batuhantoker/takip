'use client';

import { useState } from 'react';
import { useT } from '@/components/ui/use-t';
import type { Airport } from '@/lib/feeds/aviation/flight-watch';
import { clockTime } from '@/components/map/inspect/format';
import { Note } from '@/components/map/inspect/parts/inspect-card';
import type { RouteState } from '@/components/map/inspect/types';

function End({ ap, align }: { ap: Airport | null; align: 'left' | 'right' }) {
  const t = useT();
  return (
    <div className={align === 'right' ? 'min-w-0 text-right' : 'min-w-0'}>
      <div className="font-mono text-[15px]/5 font-medium text-ink-1 tabular-nums">{ap ? ap.iata || ap.icao : '—'}</div>
      <div className="truncate text-[11px]/[14px] text-ink-3">{ap?.city || (ap ? ap.icao : t('Unknown'))}</div>
    </div>
  );
}

const clock = (time: string) => <span className="font-mono tabular-nums text-ink-2">{time}</span>;

/** From → to, with progress when the schedule agrees with what the aircraft is doing. */
export function RouteBlock({ route }: { route: RouteState }) {
  const t = useT();
  const [now] = useState(() => Date.now());
  if (route.status === 'loading') return <Note>{t('Finding the route…')}</Note>;
  if (route.status !== 'found') {
    const text = route.status === 'mismatch' ? t('The schedule for this callsign is a different leg')
      : route.status === 'unavailable' ? t('Route lookup unavailable') : t('No scheduled route');
    return <Note>{route.tracked ? t('{status} · flown track on the map', { status: text }) : text}</Note>;
  }

  const { origin, destination, schedule, landed } = route;
  const pct = schedule?.progress != null ? Math.round(schedule.progress * 100) : null;
  const dep = clockTime(schedule?.departureTime, t.intl);
  const arr = clockTime(schedule?.arrivalTime, t.intl);
  const past = (iso?: string | null) => !!iso && Date.parse(iso) < now;
  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <End ap={origin} align="left" />
        <span aria-hidden className="text-[12px] text-ink-3">→</span>
        <End ap={destination} align="right" />
      </div>
      {pct != null && (
        <div className="h-0.5 overflow-hidden rounded-full bg-surface-3" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={t('Flight progress')}>
          <div className="h-full rounded-full bg-ink-2" style={{ width: `${pct}%` }} />
        </div>
      )}
      <div className="flex justify-between gap-2 text-[11px]/[14px] text-ink-3">
        <span>{dep && (past(schedule?.departureTime) ? t.rich('Departed {time}', { time: clock(dep) }) : t.rich('Departs {time}', { time: clock(dep) }))}</span>
        {pct != null && <span className="font-mono tabular-nums">{pct}%{schedule?.totalDistanceKm ? ` · ${schedule.totalDistanceKm.toLocaleString(t.intl)} km` : ''}</span>}
        <span>{landed ? t('Landed') : arr ? (past(schedule?.arrivalTime) ? t.rich('Arrived {time}', { time: clock(arr) }) : t.rich('Arrives {time}', { time: clock(arr) })) : !schedule ? t('Seen on the track, not scheduled') : ''}</span>
      </div>
    </div>
  );
}
