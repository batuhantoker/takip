'use client';

import type { Dispatch, ReactNode, SetStateAction } from 'react';
import { Globe, History } from 'lucide-react';
import ScaleBar from './scale-bar';
import { cx } from '@/components/ui/class-names';
import { useT } from '@/components/ui/use-t';
import type { ControlId, Corner } from '@/components/shell/layout/lib/model';
import type { MapProjection, MapStyle, MapView } from '@/components/shell/state/types';
import { BaseMapButton } from './base-map-button';
import { CameraButtons } from './camera-buttons';
import { ClusterButton, ClusterDivider } from './cluster-button';
import MapCredits from './map-credits';
import { useLiveView } from './use-live-view';

/** The scale, following the camera as it moves, not only once it settles; a piece of the layout of its own. */
export function LiveScaleBar({ settled, corner }: { settled: MapView; corner: Corner }) {
  const view = useLiveView(settled);
  return (
    <div className={corner.startsWith('top') ? 'mt-2' : 'mb-2'}>
      <ScaleBar zoom={view.zoom} latitude={view.latitude} />
    </div>
  );
}

/**
 * Every map control in one capsule: zoom (and a compass once the map is turned),
 * globe or flat, the base map with its options, and replay. The map's credits sit
 * on its side toward the middle, so they go wherever it goes. On a desktop it is a
 * piece of the layout, placed by its corner; a phone keeps it bottom-right.
 */
export default function MapCluster({ revealed, isMobile, corner = 'bottom-right', button = () => true, mapProjection, setMapProjection, selectFlatMap, mapStyle, setMapStyle, replayOn, onReplay, options }: {
  revealed: boolean;
  isMobile: boolean;
  corner?: Corner;
  /** The buttons the person kept (Settings → Layout); with none, only the credits show. */
  button?: (id: ControlId) => boolean;
  mapProjection: MapProjection;
  setMapProjection: Dispatch<SetStateAction<MapProjection>>;
  selectFlatMap: () => void;
  mapStyle: MapStyle;
  setMapStyle: Dispatch<SetStateAction<MapStyle>>;
  replayOn: boolean;
  onReplay?: () => void;
  options?: (openStudio: () => void, close: () => void) => ReactNode;
}) {
  const t = useT();
  const globe = mapProjection === 'globe';
  const zoom = button('zoom');
  const middle = button('globe') || button('basemap');
  const replay = !!onReplay && button('replay');
  const toolbar = (zoom || middle || replay) && (
    <div role="toolbar" data-map-cluster aria-label={t('Map controls')} aria-orientation="vertical"
      className={cx('pointer-events-auto flex flex-col overflow-hidden rounded-float border border-line bg-surface-1 shadow-float', !revealed && 'invisible')}>
      {/* Hidden rather than unmounted, so a held zoom button is never orphaned mid-press. */}
      <div className={cx('flex flex-col', !zoom && 'hidden')}><CameraButtons touch={isMobile} /></div>
      {zoom && middle && <ClusterDivider />}
      {button('globe') && (
        <ClusterButton label={t('Globe')} kbd="G" active={globe} touch={isMobile} onClick={() => (globe ? selectFlatMap() : setMapProjection('globe'))}>
          <Globe aria-hidden className="size-4" strokeWidth={1.75} />
        </ClusterButton>
      )}
      {button('basemap') && <BaseMapButton mapStyle={mapStyle} setMapStyle={setMapStyle} options={options} touch={isMobile} corner={corner} />}
      {replay && (
        <>
          {(zoom || middle) && <ClusterDivider />}
          <ClusterButton label={replayOn ? t('Back to live') : t('Replay recorded traffic')} kbd="P" active={replayOn} touch={isMobile} onClick={onReplay}>
            <History aria-hidden className="size-4" strokeWidth={1.75} />
          </ClusterButton>
        </>
      )}
    </div>
  );

  if (isMobile) {
    return (
      <div data-hud className={cx(
        'pointer-events-none absolute right-3 bottom-[calc(var(--shell-bottom,56px)+12px+env(safe-area-inset-bottom))] z-[240] flex items-end gap-2',
        'transition-[opacity,bottom] duration-150 ease-out motion-reduce:transition-none',
        revealed ? 'opacity-100' : 'opacity-0',
      )}>
        <MapCredits corner="bottom-right" />
        {toolbar}
      </div>
    );
  }
  const right = corner.endsWith('right');
  return (
    <div className={cx('flex gap-2', corner.startsWith('top') ? 'items-start' : 'items-end')}>
      {right && <MapCredits corner={corner} />}
      {toolbar}
      {!right && <MapCredits corner={corner} />}
    </div>
  );
}
