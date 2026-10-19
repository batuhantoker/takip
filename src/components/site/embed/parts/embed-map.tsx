'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import dynamic from 'next/dynamic';
import type { MapOptions } from 'maplibre-gl';
import ErrorBoundary from '@/components/ui/error-boundary';
import { useT } from '@/components/ui/use-t';
import MapCredits from '@/components/map/controls/map-credits';
import { useLiveFeed } from '@/components/map/cameras/use-live-feed';
import { parseTrack, requestTrack, stopTracking, trackKey } from '@/components/map/inspect/track-request';
import { windowStore } from '@/components/map/windows';
import { useLiveData } from '@/components/shell/state/use-live-data';
import { useMalwareStream } from '@/components/shell/state/use-malware-stream';
import { useNearbyFlights } from '@/components/shell/state/use-nearby-flights';
import { useSdkEntities } from '@/components/shell/state/use-sdk-entities';
import type { BackendStatus, FlyToTarget, LiveData, MapCenter } from '@/components/shell/state/types';
import { embedLayers, type EmbedSpec } from '@/lib/map/embed/spec';
import { useWindowData } from '../hooks/use-window-data';
import { WindowCaption } from './window-caption';

const WorldMap = dynamic(() => import('@/components/map/world-map'), { ssr: false });
const CameraWindows = dynamic(() => import('@/components/map/cameras/camera-windows'));
const LiveFeedModal = dynamic(() => import('@/components/map/cameras/live-feed-modal'));

const ignore = () => {};

/** What a click on the map hands up: a camera, a news channel, or something with its own popup. */
type Picked = Record<string, unknown> & { type?: string; url?: string; name?: string; embed_allowed?: boolean };

function startCamera(spec: EmbedSpec): Partial<MapOptions> {
  if (spec.bbox) {
    const [w, s, e, n] = spec.bbox;
    return { bounds: [[w, s], [w > e ? e + 360 : e, n]], fitBoundsOptions: { padding: 24 } };
  }
  return spec.view ? { center: [spec.view.lon, spec.view.lat], zoom: spec.view.zoom } : {};
}

/**
 * The live map with only `spec`'s layers: the full map's own map and data hooks, without its shell,
 * panels, splash, map-time count or usage reports. Pan and zoom, and a click opens the usual popup.
 */
export default function EmbedMap({ spec }: { spec: EmbedSpec }) {
  const t = useT();
  const dataRef = useRef<LiveData>({});
  // The hooks write dataRef and then bump the version; the bump takes a copy for the render.
  const [snap, setSnap] = useState<{ version: number; data: LiveData }>({ version: 0, data: {} });
  const setDataVersion = useCallback<Dispatch<SetStateAction<number>>>(() => setSnap(s => ({ version: s.version + 1, data: dataRef.current })), []);
  const { version: dataVersion, data } = snap;
  const [, setBackendStatus] = useState<BackendStatus>('connecting');
  const [zoom, setZoom] = useState(spec.view?.zoom ?? 2);
  const [mapCenter, setMapCenter] = useState<MapCenter | null>(null);
  const [flyTo, setFlyTo] = useState<FlyToTarget | null>(null);
  // Undefined until the first camera is opened, so the player loads only then.
  const [camera, setCamera] = useState<Picked | null | undefined>(undefined);
  const { openFeed, ...feed } = useLiveFeed();

  const layers = useMemo(() => embedLayers(spec), [spec]);
  // Under a window the windowed layers load their window (use-window-data.ts), so nothing polls today's feed.
  const live = useMemo(() => (spec.window ? embedLayers({ layers: [], window: spec.window }) : layers), [spec.window, layers]);
  useLiveData({ dataRef, setDataVersion, setBackendStatus, setSpaceWeather: ignore, activeLayers: live, panels: false });
  useNearbyFlights({ dataRef, dataVersion, setDataVersion, mapCenter, zoom, activeLayers: live, replayActive: false });
  useMalwareStream({ dataRef, setDataVersion, setBackendStatus, activeLayers: live });
  useSdkEntities({ dataRef, data, dataVersion, activeLayers: live });
  const shown = useWindowData({ spec, dataRef, setDataVersion });

  useEffect(() => {
    const target = parseTrack(spec.track);
    if (!target) return;
    requestTrack(target);
    // Its card opens folded to the header, so a small frame keeps the map; a click unfolds it.
    const id = trackKey(target);
    let folded = false;
    const fold = () => {
      if (folded || !windowStore.find(id)) return;
      folded = true;
      windowStore.fold(id, true);
    };
    const unsubscribe = windowStore.subscribe(fold);
    return () => { unsubscribe(); stopTracking(); };
  }, [spec.track]);

  // Read once, as the map is built. Framed in a page, one finger and the wheel scroll the page, not the map.
  const [mapOptions] = useState<Partial<MapOptions>>(() => ({
    ...startCamera(spec),
    cooperativeGestures: typeof window !== 'undefined' && window.self !== window.top,
    locale: {
      'CooperativeGesturesHandler.WindowsHelpText': t('Use Ctrl + scroll to zoom the map'),
      'CooperativeGesturesHandler.MacHelpText': t('Use ⌘ + scroll to zoom the map'),
      'CooperativeGesturesHandler.MobileHelpText': t('Use two fingers to move the map'),
    },
  }));

  const onEntityClick = useCallback((entity: Picked | null) => {
    if (entity?.type === 'cctv') setCamera(entity);
    if (entity?.type === 'live_news' && entity.url) openFeed(entity.url, entity.name ?? '', entity.embed_allowed !== false);
  }, [openFeed]);
  const onViewStateChange = useCallback((vs: { zoom: number }) => setZoom(vs.zoom), []);

  return (
    <>
      <ErrorBoundary name="Map">
        <WorldMap data={data} activeLayers={layers} mapOptions={mapOptions} contextMenu={false} flyToLocation={flyTo}
          onEntityClick={onEntityClick} onViewStateChange={onViewStateChange} onMapCenter={setMapCenter} />
      </ErrorBoundary>
      {shown && <WindowCaption shown={shown} />}
      <div className="absolute right-3 bottom-3 z-30">
        <MapCredits corner="bottom-right" />
      </div>
      {camera !== undefined && (
        <CameraWindows camera={camera} onClose={() => setCamera(null)} onLocate={(lat, lng) => setFlyTo({ lat, lng, ts: Date.now() })} />
      )}
      {feed.liveFeedUrl && (
        <LiveFeedModal liveFeedUrl={feed.liveFeedUrl} liveFeedName={feed.liveFeedName} liveFeedEmbedAllowed={feed.liveFeedEmbedAllowed} setLiveFeedUrl={feed.setLiveFeedUrl} />
      )}
    </>
  );
}
