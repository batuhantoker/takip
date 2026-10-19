'use client';

import { useEffect, useMemo, useState } from 'react';
import { Tooltip } from '@/components/ui/tooltip';
import { cx, FOCUS_RING, TRANSITION } from '@/components/ui/class-names';
import { useT } from '@/components/ui/use-t';
import type { Translate } from '@/lib/core/i18n/translator';

type Quake = { id?: string; lat: number; lng: number; magnitude: number; place?: string; time: number };

const SIGNIFICANT = 4.5;
const DAY = 86_400_000;

/** "just now", "14 min ago", "3 h ago". */
export function ago(ms: number, t: Translate, now = Date.now()) {
  const min = Math.round((now - ms) / 60_000);
  if (min < 1) return t('just now');
  if (min < 60) return t('{n} min ago', { n: min });
  return t('{n} h ago', { n: Math.round(min / 60) });
}

/** The time now, to the minute, so "14 min ago" keeps up. */
function useMinute() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(iv);
  }, []);
  return now;
}

/** The newest M4.5+ earthquake in the last day, from what the map already has. Click to go there. */
export function LatestQuake({ quakes, onLocate }: { quakes: unknown; onLocate: (lat: number, lng: number) => void }) {
  const t = useT();
  const now = useMinute();
  const quake = useMemo(() => {
    if (!Array.isArray(quakes)) return null;
    const since = now - DAY;
    let best: Quake | null = null;
    for (const q of quakes as Quake[]) {
      if (q?.magnitude >= SIGNIFICANT && q.time > since && Number.isFinite(q.lat) && (!best || q.time > best.time)) best = q;
    }
    return best;
  }, [quakes, now]);
  if (!quake) return null;

  return (
    <Tooltip label={t('Newest M4.5+ earthquake · show it on the map')} side="top">
      <button type="button" onClick={() => onLocate(quake.lat, quake.lng)}
        className={cx('flex h-5 max-w-[300px] min-w-0 items-center gap-1.5 rounded-control px-1 -mx-1 hover:bg-surface-2 hover:text-ink-2', FOCUS_RING, TRANSITION)}>
        <span className="font-mono tabular-nums text-ink-2">M{quake.magnitude.toFixed(1)}</span>
        {quake.place && <span className="truncate">{quake.place}</span>}
        <span className="shrink-0">· {ago(quake.time, t, now)}</span>
      </button>
    </Tooltip>
  );
}
