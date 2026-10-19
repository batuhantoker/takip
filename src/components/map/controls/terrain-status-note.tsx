'use client';

import { Button } from '@/components/ui/button';
import { useT } from '@/components/ui/use-t';
import { TERRAIN_MIN_ZOOM, type TerrainStatus } from '@/lib/map/terrain/terrain';

/** What 3D terrain is doing right now, with the way out when it is idle or failed. */
export default function TerrainStatusNote({ status, onFocus, onRetry }: { status: TerrainStatus; onFocus?: () => void; onRetry?: () => void }) {
  const t = useT();
  return (
    <div className="my-1 rounded-card bg-surface-2 p-3 text-small text-ink-2">
      <p role="status">
        {status === 'idle' ? t('Terrain shows from zoom {zoom}. Zoom in to see it.', { zoom: TERRAIN_MIN_ZOOM })
          : status === 'waiting' ? t('Terrain starts when you stop moving.')
          : status === 'loading' ? t('Loading nearby terrain…')
          : status === 'error' ? t('Terrain is unavailable; the map still works.')
          : t('Terrain is on.')}
      </p>
      {status === 'idle' && onFocus && <Button size="sm" className="mt-2" onClick={onFocus}>{t('Zoom to terrain')}</Button>}
      {status === 'error' && onRetry && <Button size="sm" className="mt-2" onClick={onRetry}>{t('Try again')}</Button>}
      <p className="mt-2 text-meta text-ink-3">
        {t.rich('Nearby detail only, from cached tiles · {credits}', {
          credits: <a className="underline underline-offset-2 hover:text-ink-2" href="https://github.com/tilezen/joerd/blob/master/docs/attribution.md" target="_blank" rel="noopener noreferrer">{t('credits')}</a>,
        })}
      </p>
    </div>
  );
}
