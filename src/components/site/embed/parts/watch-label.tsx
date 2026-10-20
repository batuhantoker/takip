'use client';

import { trackKey, useTrackStatus } from '@/components/map/inspect/track-request';
import type { SatelliteRow } from '@/components/map/types';

/**
 * The watched satellite's name beside it. A watch holds it at the middle of the frame, seen from straight above,
 * so the name sits there too, until the person moves the map off it.
 */
export function WatchLabel({ satellites }: { satellites: unknown }) {
  const track = useTrackStatus();
  if (!track?.watch || track.status !== 'tracking') return null;
  const key = trackKey(track.target);
  const name = (satellites as SatelliteRow[] | undefined)?.find(r => `satellite:${r.noradId}` === key)?.name;
  if (!name) return null;
  return (
    <span className="pointer-events-none absolute top-1/2 left-1/2 z-10 ml-4 -translate-y-1/2 rounded-control bg-surface-0/75 px-1.5 py-0.5 text-[12px] font-semibold text-ink-1">
      {name}
    </span>
  );
}
