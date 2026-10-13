'use client';

import { Crosshair, LocateFixed } from 'lucide-react';
import { IconButton } from '@/components/ui/button';
import { Dot } from '@/components/ui/tag';

/** "Live" beside the title while the device's position is being followed. */
export function LiveMark() {
  return <span className="inline-flex items-center gap-1.5 text-green"><Dot tone="green" pulse />Live</span>;
}

/** The planner's header actions: track my position live, and keep the map on me while tracking. */
export default function DirectionsActions({ tracking, follow, setFollow, onFollowChange, toggleTracking }: {
  tracking: boolean;
  follow: boolean;
  setFollow: (follow: boolean) => void;
  onFollowChange?: (follow: boolean) => void;
  toggleTracking: () => void;
}) {
  return (
    <>
      <IconButton icon={Crosshair} active={tracking} onClick={toggleTracking}
        label={tracking ? 'Stop tracking my location' : 'Track my location live'} />
      {tracking && (
        <IconButton icon={LocateFixed} active={follow} label={follow ? 'Stop following me' : 'Keep the map centred on me'}
          onClick={() => { const n = !follow; setFollow(n); onFollowChange?.(n); }} />
      )}
    </>
  );
}
