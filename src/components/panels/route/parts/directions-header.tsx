'use client';

import { Crosshair, LocateFixed } from 'lucide-react';
import { IconButton } from '@/components/ui/button';
import { Dot } from '@/components/ui/tag';
import { useT } from '@/components/ui/use-t';

/** "Live" beside the title while the device's position is being followed. */
export function LiveMark() {
  const t = useT();
  return <span className="inline-flex items-center gap-1.5 text-green"><Dot tone="green" pulse />{t('Live')}</span>;
}

/** The planner's header actions: track my position live, and keep the map on me while tracking. */
export default function DirectionsActions({ tracking, follow, setFollow, onFollowChange, toggleTracking }: {
  tracking: boolean;
  follow: boolean;
  setFollow: (follow: boolean) => void;
  onFollowChange?: (follow: boolean) => void;
  toggleTracking: () => void;
}) {
  const t = useT();
  return (
    <>
      <IconButton icon={Crosshair} active={tracking} onClick={toggleTracking}
        label={tracking ? t('Stop tracking my location') : t('Track my location live')} />
      {tracking && (
        <IconButton icon={LocateFixed} active={follow} label={follow ? t('Stop following me') : t('Keep the map centred on me')}
          onClick={() => { const n = !follow; setFollow(n); onFollowChange?.(n); }} />
      )}
    </>
  );
}
