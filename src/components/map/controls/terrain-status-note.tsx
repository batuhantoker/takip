'use client';

import { Button } from '@/components/ui/button';
import { TERRAIN_MIN_ZOOM, type TerrainStatus } from '@/lib/map/terrain/terrain';

/** What 3D terrain is doing right now, with the way out when it is idle or failed. */
export default function TerrainStatusNote({ status, onFocus, onRetry }: { status: TerrainStatus; onFocus?: () => void; onRetry?: () => void }) {
  return (
    <div className="my-1 rounded-card bg-surface-2 p-3 text-small text-ink-2">
      <p role="status">
        {status === 'idle' ? `Terrain shows from zoom ${TERRAIN_MIN_ZOOM}. Zoom in to see it.`
          : status === 'waiting' ? 'Terrain starts when you stop moving.'
          : status === 'loading' ? 'Loading nearby terrain…'
          : status === 'error' ? 'Terrain is unavailable; the map still works.'
          : 'Terrain is on.'}
      </p>
      {status === 'idle' && onFocus && <Button size="sm" className="mt-2" onClick={onFocus}>Zoom to terrain</Button>}
      {status === 'error' && onRetry && <Button size="sm" className="mt-2" onClick={onRetry}>Try again</Button>}
      <p className="mt-2 text-meta text-ink-3">
        Nearby detail only, from cached tiles ·{' '}
        <a className="underline underline-offset-2 hover:text-ink-2" href="https://github.com/tilezen/joerd/blob/master/docs/attribution.md" target="_blank" rel="noopener noreferrer">credits</a>
      </p>
    </div>
  );
}
