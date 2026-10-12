'use client';

import { TERRAIN_MIN_ZOOM, type TerrainStatus } from '@/lib/map-terrain';

/** What 3D terrain is doing right now, with the way out when it is idle or failed. */
export default function TerrainStatusNote({ status, onFocus, onRetry }: { status: TerrainStatus; onFocus?: () => void; onRetry?: () => void }) {
  return (
    <div className="mt-1 mb-1 rounded-lg border border-white/10 bg-white/[0.03] p-2.5 text-[11px] text-white/60">
      <p role="status">
        {status === 'idle' ? `Terrain shows from zoom ${TERRAIN_MIN_ZOOM}; zoom in`
          : status === 'waiting' ? 'Terrain starts when you stop moving'
          : status === 'loading' ? 'Loading nearby terrain…'
          : status === 'error' ? 'Terrain unavailable; the map is still usable.'
          : 'Terrain on'}
      </p>
      {status === 'idle' && <button type="button" onClick={onFocus} className="mt-2 min-h-7 rounded border border-white/15 px-2 text-[var(--gold-primary)] hover:bg-white/10">Zoom to terrain</button>}
      {status === 'error' && <button type="button" onClick={onRetry} className="mt-2 min-h-7 rounded border border-white/15 px-2 text-[var(--gold-primary)] hover:bg-white/10">Retry terrain</button>}
      <p className="mt-2 text-white/35">
        Nearby detail only · cached tiles ·{' '}
        <a className="underline underline-offset-2" href="https://github.com/tilezen/joerd/blob/master/docs/attribution.md" target="_blank" rel="noopener noreferrer">credits</a>
      </p>
    </div>
  );
}
