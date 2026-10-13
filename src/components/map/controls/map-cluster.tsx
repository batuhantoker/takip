'use client';

import type { Dispatch, ReactNode, SetStateAction } from 'react';
import { Globe, History } from 'lucide-react';
import ScaleBar from './scale-bar';
import { cx } from '@/components/ui/class-names';
import type { MapProjection, MapStyle, MapView } from '@/components/shell/state/types';
import { BaseMapButton } from './base-map-button';
import { CameraButtons } from './camera-buttons';
import { ClusterButton, ClusterDivider } from './cluster-button';
import { useLiveView } from './use-live-view';

/** Follows the camera as it moves, not only once it settles. */
function LiveScaleBar({ settled }: { settled: MapView }) {
  const view = useLiveView(settled);
  return <ScaleBar zoom={view.zoom} latitude={view.latitude} />;
}

/**
 * Every map control in one capsule at the bottom-right: zoom (and a compass
 * once the map is turned), globe or flat, the base map with its options, and
 * replay. The scale sits quietly beside it, clear of the map's credits button.
 */
export default function MapCluster({ revealed, isMobile, mapProjection, setMapProjection, selectFlatMap, mapStyle, setMapStyle, mapView, replayOn, onReplay, options }: {
  revealed: boolean;
  isMobile: boolean;
  mapProjection: MapProjection;
  setMapProjection: Dispatch<SetStateAction<MapProjection>>;
  selectFlatMap: () => void;
  mapStyle: MapStyle;
  setMapStyle: Dispatch<SetStateAction<MapStyle>>;
  mapView: MapView;
  replayOn: boolean;
  onReplay?: () => void;
  options?: (openStudio: () => void, close: () => void) => ReactNode;
}) {
  const globe = mapProjection === 'globe';
  return (
    <div data-hud className={cx(
      'pointer-events-none absolute right-3 z-[240] flex items-end gap-2',
      'transition-[opacity,bottom] duration-150 ease-out motion-reduce:transition-none',
      isMobile ? 'bottom-[calc(68px+env(safe-area-inset-bottom))]' : 'bottom-[calc(var(--shell-bottom,28px)+12px)]',
      revealed ? 'opacity-100' : 'opacity-0',
    )}>
      {!isMobile && (
        <div className="mb-2 flex items-end gap-2">
          <LiveScaleBar settled={mapView} />
          {/* Room for the map's credits button, which globals.css parks here. */}
          <span aria-hidden className="w-6" />
        </div>
      )}
      <div role="toolbar" aria-label="Map controls" aria-orientation="vertical"
        className={cx('pointer-events-auto flex flex-col overflow-hidden rounded-float border border-line bg-surface-1 shadow-float', !revealed && 'invisible')}>
        <CameraButtons touch={isMobile} />
        <ClusterDivider />
        <ClusterButton label="Globe" kbd="G" active={globe} touch={isMobile} onClick={() => (globe ? selectFlatMap() : setMapProjection('globe'))}>
          <Globe aria-hidden className="size-4" strokeWidth={1.75} />
        </ClusterButton>
        <BaseMapButton mapStyle={mapStyle} setMapStyle={setMapStyle} options={options} touch={isMobile} />
        {onReplay && (
          <>
            <ClusterDivider />
            <ClusterButton label={replayOn ? 'Back to live' : 'Replay recorded traffic'} kbd="P" active={replayOn} touch={isMobile} onClick={onReplay}>
              <History aria-hidden className="size-4" strokeWidth={1.75} />
            </ClusterButton>
          </>
        )}
      </div>
    </div>
  );
}
