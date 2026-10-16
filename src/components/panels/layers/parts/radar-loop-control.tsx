'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { Pause, Play } from 'lucide-react';
import { IconButton } from '@/components/ui/button';
import { radarState, setRadarLooping, subscribeRadar } from '@/lib/feeds/weather/radar';

const clock = (t: number) => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

/** Plays the last two hours of radar on a loop, under the layer like its sub-filters; Replay's time wins while it is open. */
export function RadarLoopControl() {
  const s = useSyncExternalStore(subscribeRadar, radarState, radarState);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const replaying = s.mode === 'replay';
  const ago = s.frameTime == null ? null : Math.max(0, Math.round((now - s.frameTime) / 60_000));
  const text = replaying && s.frameTime == null ? 'No radar this far back; it keeps two hours'
    : s.frameTime == null ? 'Loading frames…'
    : `${clock(s.frameTime)}${ago ? ` · ${ago} min ago` : ''}${replaying ? ' · following Replay' : ''}`;

  return (
    <div className="mb-2 ml-2 flex items-center justify-between gap-3 border-l border-line py-1 pl-[19px]">
      <span className="min-w-0 truncate text-small text-ink-2"><span className="font-mono">{text}</span></span>
      <IconButton
        size="sm"
        icon={s.looping && !replaying ? Pause : Play}
        label={replaying ? 'Radar follows Replay while it is open' : s.looping ? 'Stop the radar loop' : 'Play the last two hours'}
        tooltipSide="left"
        disabled={replaying}
        onClick={() => setRadarLooping(!s.looping)}
      />
    </div>
  );
}
