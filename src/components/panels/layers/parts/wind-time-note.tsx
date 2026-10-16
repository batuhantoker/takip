'use client';

import { useSyncExternalStore } from 'react';
import { subscribeWindTime, windDrawnTime } from '@/lib/feeds/weather/wind-field';

/** Which forecast hour the wind streaks show: GFS is a model, not a measurement. */
export function WindTimeNote() {
  const time = useSyncExternalStore(subscribeWindTime, windDrawnTime, () => null);
  const text = time
    ? `Forecast for ${new Date(time).toLocaleTimeString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' })}`
    : 'Open-Meteo arrows until the GFS field loads';
  return (
    <div className="mb-2 ml-2 border-l border-line py-1 pl-[19px] text-small text-ink-2">
      <span className="font-mono">{text}</span>
    </div>
  );
}
