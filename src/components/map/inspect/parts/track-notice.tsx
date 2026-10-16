'use client';

import { LoaderCircle, X } from 'lucide-react';
import { IconButton } from '@/components/ui/button';
import { stopTracking, useTrackStatus, type TrackTarget } from '@/components/map/inspect/track-request';

const describe = (t: TrackTarget) => (t.kind === 'aircraft' ? `aircraft ${t.id.toUpperCase()}` : `${t.kind} ${t.id}`);

/** While a shared link (or TI) looks for what it should follow, and when it isn't in the data. */
export function TrackNotice() {
  const request = useTrackStatus();
  if (!request || request.status === 'tracking') return null;
  const looking = request.status === 'acquiring';
  return (
    <div role="status" className="pointer-events-auto absolute top-16 left-1/2 z-20 flex h-[38px] -translate-x-1/2 items-center gap-2 rounded-float border border-line bg-surface-1 pr-1 pl-3 text-small text-ink-2 shadow-float">
      {looking && <LoaderCircle aria-hidden className="size-3.5 shrink-0 animate-spin text-ink-3 motion-reduce:animate-none" strokeWidth={1.75} />}
      <span className="whitespace-nowrap">
        {looking ? `Looking for ${describe(request.target)}…` : `${describe(request.target)} isn't in the live data now`.replace(/^./, c => c.toUpperCase())}
      </span>
      <IconButton size="sm" icon={X} label={looking ? 'Stop looking' : 'Dismiss'} onClick={stopTracking} />
    </div>
  );
}
