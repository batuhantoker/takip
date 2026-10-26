'use client';

import { useEffect, useRef, useState, useCallback, useMemo, memo } from 'react';
import * as maplibregl from 'maplibre-gl';
import { createCloudLayer } from '@/lib/feeds/weather/clouds/layer';
import type { AiGlobe } from '@/lib/ai/globe/attach';
import { MAP_DEFAULTS, type MapPalette } from '@/lib/map/style/palette';
import { InspectHost } from '@/components/map/inspect/inspect-host';
import { ReplayInspect } from '@/components/map/replay/replay-inspect';
import { pickReplay } from '@/components/map/replay/replay-pick';
import { TrackNotice } from '@/components/map/inspect/parts/track-notice';
import { useTrackRequests } from '@/components/map/inspect/use-track-requests';
import { MapMenu, type MapMenuAt } from '@/components/map/menu/map-menu';
import { SatelliteImages, type ImageryTarget } from '@/components/map/imagery/satellite-images';
import { CountryChartWindow } from '@/components/map/country-chart/country-chart-window';
import { SelectionRings } from '@/components/map/inspect/selection-rings';
import { PinnedWindows } from '@/components/map/pinned/pinned-windows';
import { findFlight } from '@/components/map/inspect/live';
import type { InspectSink } from '@/components/map/inspect/types';
import { inspectId, useInspect } from '@/components/map/inspect/use-inspect';
import { useIsMobile } from '@/components/ui/use-is-mobile';
import { WindowLayer, windowStore } from '@/components/map/windows';
import type { WatchedFlight } from '@/lib/feeds/aviation/flight-watch';
import { CameraLeaders } from '@/components/map/cameras/camera-leaders';
import CctvPreviews, { type PreviewCamera } from '@/components/map/cameras/cctv-previews';
import { useCameraLabels } from '@/components/map/cameras/use-camera-labels';
import MapControls from '@/components/map/controls/map-controls';
import LiveNewsPreviews, { type PreviewFeed } from '@/components/map/cameras/live-news-previews';
import type { AlertPinFeature } from '@/lib/intel/alerts/map-pins';
import { addBaseLayers } from '@/lib/map/basemap/base-layers';
import { createMap } from '@/lib/map/create';
import { bindAlertPins } from '@/components/map/interaction/bind-alert-pins';
import { bindCctvAndQuakeClicks, bindFeaturePopups } from '@/components/map/interaction/bind-feature-popups';
import { bindFlightClicks, type FlightSelector } from '@/components/map/interaction/bind-flight-clicks';
import { bindHoverTip } from '@/components/map/interaction/bind-hover-tip';
import { bindTouchTargets } from '@/lib/map/touch-targets';
import { bindSatellitePick } from '@/components/map/interaction/bind-satellite-pick';
import { bindViewEvents } from '@/components/map/interaction/bind-view-events';
import type { WorldMapProps } from './types';
import { useBasemapStyle, useDayNight } from '@/components/map/basemap/use-basemap';
import { useBasemapDetail } from '@/components/map/basemap/use-basemap-detail';
import { useBasemapProviderSource } from '@/components/map/basemap/use-basemap-provider';
import { useProjectionTerrain } from '@/components/map/basemap/use-projection-terrain';
import { useDemoSpin, useFlyTo, useMapCenter } from '@/components/map/interaction/hooks/use-camera';
import { useZoomPastGlobe } from '@/components/map/interaction/hooks/use-zoom-past-globe';
import { useDrawing } from '@/components/map/interaction/hooks/use-drawing';
import { useConflictZones, useEarthquakeLayer, useIncidentLayers } from '@/components/map/layers/hazards/use-event-layers';
import { useFlightLayers } from '@/components/map/layers/live/use-flight-layers';
import { useTransitLayer } from '@/components/map/layers/live/use-transit-layer';
import { useHikingLayer, useHikingPick } from '@/components/map/layers/reference/use-hiking-layer';
import { usePlacePick } from '@/components/map/interaction/hooks/use-place-pick';
import { useAuroraLayer } from '@/components/map/layers/hazards/use-aurora-layer';
import { useServiceStatusLayer } from '@/components/map/layers/hazards/use-service-status-layer';
import { useGnssInterferenceLayer } from '@/components/map/layers/hazards/use-gnss-interference-layer';
import { useLaunchLayer } from '@/components/map/layers/live/use-launch-layer';
import { useEarthSky } from '@/components/map/basemap/use-earth-sky';
import { useWarAlertsLayer } from '@/components/map/layers/hazards/use-war-alerts-layer';
import { useFireIncidentsLayer } from '@/components/map/layers/hazards/use-fire-incidents-layer';
import { useFirePerimetersLayer } from '@/components/map/layers/hazards/use-fire-perimeters-layer';
import { useNhcForecastLayer } from '@/components/map/layers/hazards/use-nhc-forecast-layer';
import { useAirportDelaysLayer } from '@/components/map/layers/hazards/use-airport-delays-layer';
import { useAviationWeatherLayer } from '@/components/map/layers/live/use-aviation-weather-layer';
import { useChokepointFlowLayer } from '@/components/map/layers/hazards/use-chokepoint-flow-layer';
import { useOutbreaksLayer } from '@/components/map/layers/hazards/use-outbreaks-layer';
import { useTrafficLayer } from '@/components/map/layers/live/use-traffic-layer';
import { useLayerVisibility } from '@/components/map/layers/use-layer-visibility';
import { useReplayLayer } from '@/components/map/layers/history/use-replay-layer';
import { useChoroplethLayer } from '@/components/map/layers/history/use-choropleth-layer';
import { useHistoryLayer } from '@/components/map/layers/history/use-history-layer';
import { useWarLayers } from '@/components/map/layers/history/use-war-layers';
import { useWorldBordersLayer } from '@/components/map/layers/history/use-world-borders-layer';
import { useOhmDetailLayer } from '@/components/map/layers/history/use-ohm-detail-layer';
import { usePaleoLayer } from '@/components/map/layers/history/use-paleo-layer';
import { useMapPalette } from '@/components/map/basemap/use-map-palette';
import { useDirections, useUserLocation } from '@/components/map/layers/overlays/use-navigation';
import { useCyberLayers, useSdkLinks } from '@/components/map/layers/live/use-network-layers';
import { useAlertPins, useLiveNewsLayer } from '@/components/map/layers/live/use-news-layers';
import { useAiHighlights } from '@/components/map/layers/overlays/use-ti-highlights';
import { useAiGlobe } from '@/components/map/layers/overlays/use-ai-globe';
import { useArcgisLayers, useDrawnPolygons } from '@/components/map/layers/overlays/use-overlay-layers';
import { useBalloonLayer, useCctvLayer, useInfrastructureLayer, useMaritimeLayers, useNaturalEventLayers, useRadiationLayer } from '@/components/map/layers/live/use-point-layers';
import { useReconLayers } from '@/components/map/layers/overlays/use-recon-layers';
import { useReferenceLayers } from '@/components/map/layers/reference/use-reference-layers';
import { useAttractionsLayer } from '@/components/map/layers/reference/use-attractions-layer';
import { useRegionPick } from '@/components/map/interaction/hooks/use-region-pick';
import { useSatelliteDismiss, useSatelliteLayer } from '@/components/map/layers/live/use-satellite-layer';
import { useSatelliteMotion } from '@/components/map/layers/live/use-satellite-motion';
import { usePlacePin } from '@/components/map/layers/overlays/use-place-pin';
import { usePlanRoute } from '@/components/map/layers/overlays/use-plan-route';
import { useSatelliteSelection } from '@/components/map/layers/live/use-satellite-selection';
import { useWeatherGridLayer, useWeatherRasters } from '@/components/map/layers/hazards/use-weather-layers';
import { useGibsImagery } from '@/components/map/layers/live/use-gibs-imagery';
import { useRadarLayer } from '@/components/map/layers/hazards/use-radar-layer';
import { useLightningLayer } from '@/components/map/layers/hazards/use-lightning-layer';
import { useWindLayer } from '@/components/map/layers/hazards/use-wind-layer';
import 'maplibre-gl/dist/maplibre-gl.css';
import './map-popup.css';

/** Replay draws recorded quakes from the history events; History draws the families its panel picks. */
const NO_FAMILIES: readonly string[] = [];
const QUAKES: readonly string[] = ['hazard'];

function WorldMap({ data, activeLayers, onEntityClick, onMouseCoords, onRightClick, onViewStateChange, onReady, mapOptions, contextMenu = true, flyToLocation, alertPinIds = null, projection = 'globe', terrainEnabled = false, terrainRetry = 0, terrainFocus = 0, onTerrainStatusChange, mapStyle = 'dark', sweepData, scanTargets = [], demoMode = false, theme = 'core', drawnPolygons = [], arcgisLayers = [], imageryRequest = null, drawMode = null, onDrawComplete, onDrawProgress, onDrawCancel, drawCommand = null, onMapCenter, onZoomPastGlobe, onNearGlobe, onGlobeLink, route = null, userLocation = null, pin = null, plan = null, followUser = false, onFollowInterrupt, navigating = false, onAiGlobe, onAiSelect, onAiHover, onAiFollow, aiHighlight = null, mobileSheetOpen = false, onInspectOpen, replay = null, onReplayToggle, history = null, historyFamilies = NO_FAMILIES, historyKinds = NO_FAMILIES }: WorldMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const popupRef = useRef<maplibregl.Popup | null>(null);
  /* The Live Alert pins currently drawn, and the opener for one of them, so
     the feed's locate button can land on a pin and open it. */
  const alertPinsRef = useRef<AlertPinFeature[]>([]);
  const openAlertPinRef = useRef<((id: string) => void) | null>(null);
  const [mapReady, setMapReady] = useState(false);

  const wasNavigating = useRef(false);
  /**
   * What the map's own layers draw with, mirrored out of the `--map-*` custom
   * properties. Held in state rather than read at each use so a change re-runs
   * the recolour effects; held in a ref as well for the click handlers, which
   * are registered once on load and would otherwise close over the first value.
   */
  const [palette, setPalette] = useState<MapPalette>(MAP_DEFAULTS);
  const paletteRef = useRef(palette);
  useEffect(() => { paletteRef.current = palette; }, [palette]);
  const onReadyRef = useRef(onReady);
  useEffect(() => { onReadyRef.current = onReady; }, [onReady]);
  const prevDrawnPolygonsRef = useRef<string[]>([]);
  const prevArcgisLayersRef = useRef<string[]>([]);
  const cloudLayerRef = useRef<ReturnType<typeof createCloudLayer> | null>(null);
  const aiGlobeRef = useRef<AiGlobe | null>(null);
  const {
    satLayerRef, satRowsRef, satSelectRef, satPickedRef, satSelectedIdRef, satEpochRef,
    selectedSat, setSelectedSat, clearSat,
  } = useSatelliteSelection();
  const [mapMenu, setMapMenu] = useState<MapMenuAt | null>(null);
  const [imagery, setImagery] = useState<{ target: ImageryTarget; key: string } | null>(null);
  // An Areas row asks through a prop; take each new ask as it renders.
  const [seenImageryRequest, setSeenImageryRequest] = useState(imageryRequest);
  if (imageryRequest !== seenImageryRequest) {
    setSeenImageryRequest(imageryRequest);
    if (imageryRequest) setImagery({ target: { shape: imageryRequest.shape, name: imageryRequest.name }, key: `area-${imageryRequest.seq}` });
  }

  /* Each aircraft and ship gets a window; the satellite's sits beside them. */
  const onInspectOpenRef = useRef(onInspectOpen);
  useEffect(() => { onInspectOpenRef.current = onInspectOpen; }, [onInspectOpen]);
  const openedForInspect = useCallback(() => { onInspectOpenRef.current?.(); }, []);
  const isMobile = useIsMobile();
  const isMobileRef = useRef(isMobile);
  useEffect(() => { isMobileRef.current = isMobile; }, [isMobile]);
  const inspect = useInspect(openedForInspect);
  const inspectRef = useRef(inspect);
  useEffect(() => { inspectRef.current = inspect; }, [inspect]);
  const flightSelectRef = useRef<FlightSelector | null>(null);
  const satKey = selectedSat ? selectedSat.noradId ?? selectedSat.name : null;
  const closeInspect = inspect.closeAll;
  useEffect(() => { if (satKey) onInspectOpenRef.current?.(); }, [satKey]);
  // One sheet at a time on a phone: a panel opening closes the card.
  useEffect(() => { if (mobileSheetOpen) { closeInspect(); clearSat(); } }, [mobileSheetOpen, closeInspect, clearSat]);
  // History and Replay show the past; a live selection has nothing to say there.
  const timeTravel = !!history || !!replay;
  useEffect(() => { if (timeTravel) { closeInspect(); clearSat(); } }, [timeTravel, closeInspect, clearSat]);
  // Dev-only: tools/shorts closes a card between spots; Escape doesn't reach the phone sheet.
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') Object.assign(window, { __takipInspect: { closeAll: () => { closeInspect(); clearSat(); } } });
  }, [closeInspect, clearSat]);
  // The drawn route goes when its aircraft's card closes.
  const aircraftOpen = inspect.targets.filter(t => t.kind === 'aircraft').map(t => t.id).join(' ');
  useEffect(() => {
    const drawn = flightSelectRef.current?.drawn();
    if (drawn && !aircraftOpen.split(' ').includes(drawn)) flightSelectRef.current?.clear();
  }, [aircraftOpen]);
  // The drawn route keeps up with its aircraft as fresher positions come in.
  useEffect(() => {
    const id = flightSelectRef.current?.drawn();
    const f = id ? findFlight(data, id)?.flight : null;
    if (f) flightSelectRef.current?.moveTo([f.lng, f.lat], Number(f.heading) || 0);
  }, [data.commercial_flights, data.private_flights, data.private_jets, data.military_flights]); // eslint-disable-line react-hooks/exhaustive-deps
  /** A row in the watch list: select that aircraft as if it had been clicked, and go to it. */
  const selectWatched = useCallback((flight: WatchedFlight) => {
    const found = findFlight(data, flight.icao24);
    if (!found) return;
    const { flight: f, layer } = found;
    flightSelectRef.current?.select(f, [f.lng, f.lat], layer);
    mapRef.current?.flyTo({ center: [f.lng, f.lat], zoom: Math.max(mapRef.current.getZoom(), 7), duration: 1200, essential: true });
  }, [data]);
  const drawingCoordsRef = useRef<number[][]>([]);
  const drawModeRef = useRef(drawMode);
  useEffect(() => { drawModeRef.current = drawMode; }, [drawMode]);

  useDemoSpin({ mapRef, mapReady, demoMode });

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    
    const container = containerRef.current;
    const map = createMap(container, mapOptions);
    if (!map) return;

    map.on('load', () => {
      mapRef.current = map;

      /* Measure the container once the layout has settled. The constructor
         may have read it before it had a size, and a map that starts at the
         400x300 fallback never recovers on its own. */
      map.resize();

      addBaseLayers(map, theme, satLayerRef);

      setMapReady(true);
      // 'load' means the style parsed; 'idle' means the tiles are drawn.
      // The splash waits for the second, so it lifts onto a finished globe.
      map.once('idle', () => onReadyRef.current?.());
      // Dev-only handle. The map is otherwise unreachable from the console,
      // which makes interaction bugs guesswork rather than diagnosis.
      if (process.env.NODE_ENV === 'development') (window as any).__takipMap = map;
    });

    bindViewEvents(map, container, { onMouseCoords, onRightClick, onViewStateChange, onMenu: setMapMenu });

    // ── POPUP HELPER ──
    // While a draw tool owns the map, a click on a camera or ship is a vertex or a region, not a selection.
    const drawing = () => drawModeRef.current != null;
    const entityClick: WorldMapProps['onEntityClick'] = e => { if (!drawing()) onEntityClick?.(e); };
    const popup = (coords: any, html: string) => {
      if (drawing()) return;
      popupRef.current?.remove();
      popupRef.current = new maplibregl.Popup({ closeButton: true, maxWidth: '420px', offset: 14 }).setLngLat(coords).setHTML(html).addTo(map);
      return popupRef.current;
    };

    // Overlapping markers each get the click; the first handler (aircraft, then camera, then ship) wins.
    let openedAt = -1;
    const sink: InspectSink = {
      open: t => {
        const now = performance.now();
        if (drawing() || now - openedAt < 40) return false;
        openedAt = now;
        return inspectRef.current.sink.open(t);
      },
      patch: ((kind, id, p) => inspectRef.current.sink.patch(kind, id, p)) as InspectSink['patch'],
    };
    const unbindTouch = bindTouchTargets(map);
    flightSelectRef.current = bindFlightClicks(map, sink, drawing);
    bindCctvAndQuakeClicks(map, popup, entityClick, sink);
    // Windows stay until closed; a phone's single sheet goes on a tap on the map.
    const onEmpty = () => { if (!drawing() && isMobileRef.current) { inspectRef.current.closeAll(); clearSat(); pickReplay(null); } };
    // What already has a window gets no tooltip.
    const hoverTip = bindHoverTip(map, key => !!windowStore.find(key)
      || inspectRef.current.targets.some(t => inspectId(t) === key) || (!!satSelectedIdRef.current && key === `satellite:${satSelectedIdRef.current}`), drawing);
    const satPick = bindSatellitePick(map, { satLayerRef, aiGlobeRef, satRowsRef, satPickedRef, satSelectedIdRef, satEpochRef, popupRef, paletteRef, setSelectedSat, onEmpty, onHover: row => hoverTip.setSatellite(row) });
    satSelectRef.current = satPick.select;
    bindFeaturePopups(map, popup, entityClick, sink);
    bindAlertPins(map, popup, popupRef, alertPinsRef, openAlertPinRef);

    /*
     * Keep the canvas the size of its container.
     *
     * MapLibre reads the container once, when it is constructed, and falls
     * back to 400x300 if the container has no size yet. Its own trackResize
     * watches the window, which never fires when the container is what
     * changed — so a map built a frame too early stayed 400x300 inside a full
     * screen container for the rest of the session, which is what the live
     * site was serving: a small square of map in the corner of a black page.
     * A window resize did not recover it; one resize() call did.
     */
    const sizeToContainer = new ResizeObserver(() => map.resize());
    sizeToContainer.observe(container);

    return () => {
      sizeToContainer.disconnect();
      satPick.cancel();
      hoverTip.dispose();
      unbindTouch();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useDayNight({ mapRef, mapReady, activeLayers });

  // Helper to set GeoJSON
  const setGeo = useCallback((source: string, features: any[]) => {
    const src = mapRef.current?.getSource(source) as any;
    if (src) src.setData({ type: 'FeatureCollection', features });
  }, []);

  const setVis = useCallback((ids: string[], visible: boolean) => {
    const map = mapRef.current;
    if (!map) return;
    ids.forEach(id => { if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none'); });
  }, []);

  const layerArgs = { mapRef, mapReady, data, activeLayers, setGeo };

  useFlightLayers(layerArgs);
  useMapPalette({ mapRef, mapReady, theme, palette, setPalette, aiGlobeRef });

  // ── DECOUPLED LAYER RENDERERS (Performance Optimized) ──

  useEarthquakeLayer(layerArgs);
  useSatelliteLayer({ ...layerArgs, palette, satLayerRef, satRowsRef, satPickedRef, satSelectedIdRef, satEpochRef, setSelectedSat, clearSat });
  useSatelliteMotion({ mapRef, replay, satLayerRef, satRowsRef, satPickedRef, satSelectedIdRef, satEpochRef, paletteRef, setSelectedSat, clearSat });
  useIncidentLayers(layerArgs);
  useCyberLayers(layerArgs);
  useCctvLayer(layerArgs);
  useCameraLabels(layerArgs);
  useNaturalEventLayers(layerArgs);
  useInfrastructureLayer(layerArgs);
  useMaritimeLayers(layerArgs);
  useBalloonLayer(layerArgs);
  useLaunchLayer(layerArgs);
  useEarthSky({ mapRef, mapReady, activeLayers });
  useAuroraLayer(layerArgs);
  useServiceStatusLayer(layerArgs);
  useGnssInterferenceLayer(layerArgs);
  useRadiationLayer(layerArgs);
  useWarAlertsLayer(layerArgs);
  useFireIncidentsLayer(layerArgs);
  useFirePerimetersLayer(layerArgs);
  useNhcForecastLayer(layerArgs);
  useTrackRequests({ mapRef, mapReady, data, satRowsRef, flightSelectRef, sink: inspect.sink, selectSatellite: satSelectRef });
  useAirportDelaysLayer(layerArgs);
  useAviationWeatherLayer({ mapRef, mapReady, activeLayers, replayActive: !!replay || !!history });
  useChokepointFlowLayer(layerArgs);
  useOutbreaksLayer(layerArgs);
  useTrafficLayer({ mapRef, mapReady, activeLayers, replayActive: !!replay || !!history });
  const windStreaks = useWindLayer({ mapRef, mapReady, activeLayers, mapStyle });
  useWeatherGridLayer(layerArgs, !windStreaks);
  useSdkLinks(layerArgs);
  useLiveNewsLayer(layerArgs);
  useAlertPins({ ...layerArgs, alertPinsRef, alertPinIds });
  useConflictZones(layerArgs);
  useLayerVisibility({ mapRef, mapReady, activeLayers, setVis, satRowsRef, satLayerRef, replayActive: !!replay || !!history });
  useTransitLayer({ mapRef, mapReady, activeLayers, replayActive: !!replay || !!history });
  useReplayLayer({ mapRef, mapReady, replay, activeLayers });
  useChoroplethLayer({ mapRef, mapReady, history, mapStyle });
  useWorldBordersLayer({ mapRef, mapReady, history, popupRef });
  useOhmDetailLayer({ mapRef, mapReady, history });
  useWarLayers({ mapRef, mapReady, history, popupRef });
  usePaleoLayer({ mapRef, mapReady, history, mapStyle });
  const eventFamilies = useMemo(() => (history ? historyFamilies : replay && activeLayers.earthquakes ? QUAKES : NO_FAMILIES),
    [history, historyFamilies, replay, activeLayers.earthquakes]);
  useHistoryLayer({ mapRef, mapReady, timeline: history ?? replay, families: eventFamilies, kinds: history ? historyKinds : NO_FAMILIES, popupRef });
  useReconLayers({ ...layerArgs, sweepData, scanTargets });
  useReferenceLayers(layerArgs);
  useAttractionsLayer(layerArgs);

  useProjectionTerrain({ mapRef, mapReady, containerRef, projection, terrainEnabled, terrainRetry, terrainFocus, onTerrainStatusChange });

  useFlyTo({ mapRef, mapReady, flyToLocation, openAlertPinRef });
  useBasemapStyle({ mapRef, mapReady, activeLayers, mapStyle });
  useBasemapProviderSource({ mapRef, mapReady });
  useBasemapDetail({ mapRef, mapReady });
  useWeatherRasters({ mapRef, mapReady, data, activeLayers, mapStyle, cloudLayerRef });
  useGibsImagery({ mapRef, mapReady, activeLayers, mapStyle, history: history ?? null, replay: replay ?? null });
  useRadarLayer({ mapRef, mapReady, activeLayers, mapStyle, replay: replay ?? null });
  useLightningLayer({ mapRef, mapReady, activeLayers, mapStyle, replay: replay ?? null });
  useHikingLayer({ mapRef, mapReady, activeLayers, mapStyle });
  useHikingPick({ mapRef, mapReady, activeLayers, popupRef, drawModeRef, aiGlobeRef, satPickedRef });
  usePlacePick({ mapRef, mapReady, popupRef, drawModeRef, aiGlobeRef, satPickedRef });

  useAiGlobe({ mapRef, mapReady, aiGlobeRef, paletteRef, onAiGlobe, onAiSelect, onAiHover, onAiFollow });

  useAiHighlights({ mapRef, mapReady, aiHighlight });
  useDrawnPolygons({ mapRef, mapReady, drawnPolygons, prevDrawnPolygonsRef });
  useDirections({ mapRef, mapReady, route });
  useUserLocation({ mapRef, mapReady, userLocation, followUser, onFollowInterrupt, navigating });
  usePlacePin({ mapRef, mapReady, pin });
  usePlanRoute({ mapRef, mapReady, plan });

  // Restore the selected view only when guidance ends, not on first map load.
  useEffect(() => {
    const ended = wasNavigating.current && !navigating;
    wasNavigating.current = navigating;
    if (!mapReady || !mapRef.current || !ended) return;
    const map = mapRef.current;
    const pitch = projection === 'mercator' ? 0 : activeLayers.terrain_3d ? 50 : terrainEnabled && map.getZoom() >= 10 ? 45 : 20;
    map.easeTo({ pitch, bearing: 0, duration: 600 });
  }, [mapReady, navigating, projection, terrainEnabled, activeLayers.terrain_3d]);

  useArcgisLayers({ mapRef, mapReady, arcgisLayers, prevArcgisLayersRef });
  useDrawing({ mapRef, mapReady, drawMode, drawCommand, onDrawComplete, onDrawProgress, onDrawCancel, drawingCoordsRef });
  useRegionPick({ mapRef, mapReady, active: drawMode === 'region', onDrawComplete, onDrawProgress, onDrawCancel });
  useMapCenter({ mapRef, mapReady, onMapCenter });
  useZoomPastGlobe({ mapRef, mapReady, onZoomPastGlobe, onNearGlobe, onGlobeLink });
  useSatelliteDismiss({ mapRef, mapReady, selectedSat, clearSat });

  return (
    <>
      <div ref={containerRef} className="absolute inset-0 w-full h-full" />
      {mapReady && mapRef.current && (
        <CctvPreviews
          mapRef={mapRef}
          active={!!activeLayers.cctv && !!activeLayers.cctv_previews}
          onOpen={(cam: PreviewCamera) => onEntityClick?.({ type: 'cctv', ...cam })}
        />
      )}
      {mapReady && (
        <LiveNewsPreviews
          mapRef={mapRef}
          active={!!activeLayers.live_news}
          feeds={data.live_feeds}
          onOpen={(feed: PreviewFeed) => onEntityClick?.({
            type: 'live_news',
            name: feed.name,
            city: feed.city,
            country: feed.country,
            url: feed.url,
            category: feed.category,
            embed_allowed: true,
          })}
        />
      )}
      {mapReady && (
        <InspectHost mapRef={mapRef} data={data} targets={inspect.targets} sat={selectedSat?.quiet ? null : selectedSat}
          onClose={inspect.close} onCloseAll={inspect.closeAll} onCloseSat={clearSat} onSelectFlight={selectWatched} />
      )}
      {mapReady && replay && <ReplayInspect mapRef={mapRef} session={replay} />}
      {mapReady && <SelectionRings mapRef={mapRef} />}
      {mapReady && <TrackNotice />}
      {contextMenu && mapMenu && (
        <MapMenu at={mapMenu} onClose={() => setMapMenu(null)}
          onDossier={at => onRightClick?.({ lat: at.lat, lng: at.lng })} onImagery={at => setImagery({ target: { lat: at.lat, lng: at.lng }, key: `${at.lat},${at.lng}` })} />
      )}
      {mapReady && imagery && (
        <SatelliteImages key={imagery.key} target={imagery.target} mapRef={mapRef} onClose={() => setImagery(null)} />
      )}
      {mapReady && history && <CountryChartWindow session={history} />}
      {mapReady && <PinnedWindows mapRef={mapRef} mode={history ? 'history' : replay ? 'replay' : 'live'} />}
      {mapReady && <CameraLeaders mapRef={mapRef} />}
      <WindowLayer />
      {mapReady && <MapControls mapRef={mapRef} onInteract={onFollowInterrupt} replayActive={!!replay} onReplayToggle={onReplayToggle} />}
    </>
  );
}

export default memo(WorldMap);
