'use client';

import { useState } from 'react';
import TimelineScrubber from '@/components/map/replay/timeline-scrubber';
import { calendarTicks } from '@/lib/map/replay/timeline-ticks';
import { cx, FOCUS_RING } from '@/components/ui/class-names';
import { Tooltip } from '@/components/ui/tooltip';
import { formatTime } from '@/lib/map/replay/time-input';
import type { HistoryEvent } from '@/lib/space/replay/flight-history';
import { jdFromMs, msFromJd } from '@/lib/space/horizons';
import { replayDate } from '@/lib/space/replay/format';

/** "6 Aug 2012", and "6 Aug 2012 05:17" when the flight is short enough for the hour to matter. */
export const flightDate = (jd: number, withTime = false) =>
  `${formatTime(msFromJd(jd), Number.POSITIVE_INFINITY)}${withTime ? ` ${replayDate(jd).slice(11, 16)}` : ''}`;

/** The shared timeline track over the whole flight, with its events pinned above the rail. */
export default function FlightTrack({ start, end, jd, predictedFrom, events, onSeek, onTogglePlay }: {
  start: number;
  end: number;
  jd: number;
  /** Past this the track is JPL's prediction. */
  predictedFrom?: number;
  events: HistoryEvent[];
  onSeek: (jd: number) => void;
  onTogglePlay: () => void;
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  const lo = msFromJd(start), hi = msFromJd(end);
  const left = (t: number) => `${((t - start) / (end - start)) * 100}%`;
  const short = end - start <= 400;

  return (
    <div className="relative flex min-w-[120px] flex-1 @max-xl/flight:basis-full">
      {/* Under the scrubber, so its handle and hover readout cover a pin. */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        {events.map((e, i) => (
          <span key={`${e.kind}-${e.jd}`} style={{ left: left(e.jd) }}
            className={cx('absolute top-[5px] size-[5px] -translate-x-1/2 rounded-full', e.kind === 'now' ? 'bg-green' : hovered === i ? 'bg-ink-1' : 'bg-ink-3')} />
        ))}
      </div>
      <TimelineScrubber label="Flight timeline" lo={lo} hi={hi} time={msFromJd(jd)} step={(hi - lo) / 200}
        onSeek={ms => onSeek(jdFromMs(ms))} onTogglePlay={onTogglePlay}
        format={ms => flightDate(jdFromMs(ms), short)}
        ticksFor={max => calendarTicks(lo, hi, max)}
        provisionalFrom={predictedFrom === undefined ? undefined : msFromJd(predictedFrom)}
        notes={{ provisional: 'predicted' }} />
      {/* Above the rail, so the rail itself still scrubs everywhere. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-3">
        {events.map((e, i) => (
          <Tooltip key={`${e.kind}-${e.jd}`} label={<>{e.label}<span className="ml-2 font-mono font-normal text-ink-3 tabular-nums">{flightDate(e.jd, short)}</span></>}>
            <button type="button" aria-label={e.label} onClick={() => onSeek(e.jd)}
              onPointerEnter={() => setHovered(i)} onPointerLeave={() => setHovered(null)}
              onFocus={() => setHovered(i)} onBlur={() => setHovered(null)}
              className={cx('pointer-events-auto absolute top-0 size-3 -translate-x-1/2 cursor-pointer rounded-full', FOCUS_RING)}
              style={{ left: left(e.jd) }} />
          </Tooltip>
        ))}
      </div>
    </div>
  );
}
