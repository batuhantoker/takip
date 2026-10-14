'use client';

import { useEffect, useRef, useState, useCallback, useMemo, memo } from 'react';
import * as maplibregl from 'maplibre-gl';
import { installTerrainTileProtocol } from '@/lib/map/terrain/tiles';
import { createCloudLayer } from '@/lib/weather/live-clouds-layer';
import { attachOi, type OiGlobe } from '@/lib/oi/globe';
import { createSatelliteLayer } from '@/lib/satellites/layer';
import { MAP_DEFAULTS, type MapPalette } from '@/lib/map/palette';
import { InspectHost } from '@/components/map/inspect/inspect-host';
import { SelectionRings } from '@/components/map/inspect/selection-rings';
import { findFlight } from '@/components/map/inspect/live';
import type { SatelliteDetail } from '@/components/map/inspect/cards/satellite-inspect';
import type { InspectSink } from '@/components/map/inspect/types';
import { inspectId, useInspect } from '@/components/map/inspect/use-inspect';
import { useIsMobile } from '@/components/ui/use-is-mobile';
import { WindowLayer, windowStore } from '@/components/map/windows';
import type { WatchedFlight } from '@/lib/flights/watch';
import { CameraLeaders } from '@/components/map/cameras/camera-leaders';
import CctvPreviews, { type PreviewCamera } from '@/components/map/cameras/cctv-previews';
import MapControls from '@/components/map/controls/map-controls';
import LiveNewsPreviews, { type PreviewFeed } from '@/components/map/cameras/live-news-previews';
import { attachTerrain } from '@/lib/map/terrain/terrain';
import { applyMapProjection } from '@/lib/map/projection';
import type { AlertPinFeature } from '@/lib/alerts/map-pins';
import { addBaseLayers } from '@/lib/basemap/base-layers';
import { createMap } from '@/lib/map/create';
import { bindAlertPins } from '@/components/map/interaction/bind-alert-pins';
import { bindCctvAndQuakeClicks, bindFeaturePopups } from '@/components/map/interaction/bind-feature-popups';
import { bindFlightClicks, type FlightSelector } from '@/components/map/interaction/bind-flight-clicks';
import { bindHoverTip } from '@/components/map/interaction/bind-hover-tip';
import { bindTouchTargets } from '@/lib/map/touch-targets';
import { bindSatellitePick } from '@/components/map/interaction/bind-satellite-pick';
import { bindViewEvents } from '@/components/map/interaction/bind-view-events';
import type { SatelliteRow, WorldMapProps } from './types';
import { useBasemapStyle, useDayNight } from '@/components/map/basemap/use-basemap';
import { useBasemapDetail } from '@/components/map/basemap/use-basemap-detail';
import { useBasemapProviderSource } from '@/components/map/basemap/use-basemap-provider';
import { useDemoSpin, useFlyTo, useMapCenter } from '@/components/map/interaction/hooks/use-camera';
import { useZoomPastGlobe } from '@/components/map/interaction/hooks/use-zoom-past-globe';
import { useDrawing } from '@/components/map/interaction/hooks/use-drawing';
import { useConflictZones, useEarthquakeLayer, useIncidentLayers } from '@/components/map/layers/hazards/use-event-layers';
import { useFlightLayers } from '@/components/map/layers/live/use-flight-layers';
import { useHikingLayer, useHikingPick } from '@/components/map/layers/reference/use-hiking-layer';
import { usePlacePick } from '@/components/map/interaction/hooks/use-place-pick';
import { useAuroraLayer } from '@/components/map/layers/hazards/use-aurora-layer';
import { useServiceStatusLayer } from '@/components/map/layers/hazards/use-service-status-layer';
import { useGnssInterferenceLayer } from '@/components/map/layers/hazards/use-gnss-interference-layer';
import { useLaunchLayer } from '@/components/map/layers/live/use-launch-layer';
import { useEarthSky } from '@/components/map/basemap/use-earth-sky';
import { useWarAlertsLayer } from '@/components/map/layers/hazards/use-war-alerts-layer';
import { useFireIncidentsLayer } from '@/components/map/layers/hazards/use-fire-incidents-layer';
import { useAirportDelaysLayer } from '@/components/map/layers/hazards/use-airport-delays-layer';
import { useChokepointFlowLayer } from '@/components/map/layers/hazards/use-chokepoint-flow-layer';
import { useOutbreaksLayer } from '@/components/map/layers/hazards/use-outbreaks-layer';
import { useLayerVisibility } from '@/components/map/layers/use-layer-visibility';
import { useReplayLayer } from '@/components/map/layers/history/use-replay-layer';
import { useChoroplethLayer } from '@/components/map/layers/history/use-choropleth-layer';
import { useHistoryLayer } from '@/components/map/layers/history/use-history-layer';
import { useWarLayers } from '@/components/map/layers/history/use-war-layers';
import { usePaleoLayer } from '@/components/map/layers/history/use-paleo-layer';
import { useMapPalette } from '@/components/map/basemap/use-map-palette';
import { useDirections, useUserLocation } from '@/components/map/layers/overlays/use-navigation';
import { useCyberLayers, useSdkLinks } from '@/components/map/layers/live/use-network-layers';
import { useAlertPins, useLiveNewsLayer } from '@/components/map/layers/live/use-news-layers';
import { useOiHighlights } from '@/components/map/layers/overlays/use-ti-highlights';
import { useArcgisLayers, useDrawnPolygons } from '@/components/map/layers/overlays/use-overlay-layers';
import { useBalloonLayer, useCctvLayer, useInfrastructureLayer, useMaritimeLayers, useNaturalEventLayers, useRadiationLayer } from '@/components/map/layers/live/use-point-layers';
import { useReconLayers } from '@/components/map/layers/overlays/use-recon-layers';
import { useReferenceLayers } from '@/components/map/layers/reference/use-reference-layers';
import { useRegionPick } from '@/components/map/interaction/hooks/use-region-pick';
import { useSatelliteDismiss, useSatelliteLayer } from '@/components/map/layers/live/use-satellite-layer';
import { useWeatherGridLayer, useWeatherRasters } from '@/components/map/layers/hazards/use-weather-layers';
import 'maplibre-gl/dist/maplibre-gl.css';
import './map-popup.css';

/** Replay draws recorded quakes from the history events; History draws the families its panel picks. */
const NO_FAMILIES: readonly string[] = [];
const QUAKES: readonly string[] = ['hazard'];

function WorldMap({ data, activeLayers, onEntityClick, onMouseCoords, onRightClick, onViewStateChange, onReady, flyToLocation, alertPinIds = null, projection = 'globe', terrainEnabled = false, terrainRetry = 0, terrainFocus = 0, onTerrainStatusChange, mapStyle = 'dark', sweepData, scanTargets = [], demoMode = false, theme = 'core', drawnPolygons = [], arcgisLayers = [], drawMode = null, onDrawComplete, onDrawProgress, onDrawCancel, drawCommand = null, onMapCenter, onZoomPastGlobe, onNearGlobe, onGlobeLink, route = null, userLocation = null, followUser = false, onFollowInterrupt, navigating = false, onOiGlobe, onOiSelect, onOiHover, onOiFollow, oiHighlight = null, mobileSheetOpen = false, onInspectOpen, replay = null, onReplayToggle, history = null, historyFamilies = NO_FAMILIES }: WorldMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const popupRef = useRef<maplibregl.Popup | null>(null);
  /* The Live Alert pins currently drawn, and the opener for one of them, so
     the feed's locate button can land on a pin and open it. */
  const alertPinsRef = useRef<AlertPinFeature[]>([]);
  const openAlertPinRef = useRef<((id: string) => void) | null>(null);
  const [mapReady, setMapReady] = useState(false);

  // Do not replay an earlier explicit zoom request after theme/retry remounts.
  const lastTerrainFocus = useRef(terrainFocus);
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
  const satLayerRef = useRef<ReturnType<typeof createSatelliteLayer> | null>(null);
  const cloudLayerRef = useRef<ReturnType<typeof createCloudLayer> | null>(null);
  const onOiGlobeRef = useRef(onOiGlobe);
  const onOiSelectRef = useRef(onOiSelect);
  const onOiHoverRef = useRef(onOiHover);
  const onOiFollowRef = useRef(onOiFollow);
  const oiGlobeRef = useRef<OiGlobe | null>(null);
  useEffect(() => {
    onOiGlobeRef.current = onOiGlobe;
    onOiSelectRef.current = onOiSelect;
    onOiHoverRef.current = onOiHover;
    onOiFollowRef.current = onOiFollow;
  }, [onOiGlobe, onOiSelect, onOiHover, onOiFollow]);
  // pick() returns an index into the array last handed to setPoints, so the
  // matching catalogue rows are kept in the same order to resolve it.
  const satRowsRef = useRef<SatelliteRow[]>([]);
  /** Index of the selected satellite in the array last handed to setPoints. */
  const satPickedRef = useRef<number | null>(null);
  /** The selection's NORAD id. The index moves whenever the catalogue is
   *  re-polled and re-filtered; the id does not, so it is what identifies the
   *  selection across a refresh and what discards a late orbit reply. */
  const satSelectedIdRef = useRef<string | null>(null);
  /** When the catalogue positions were propagated for, so an orbit can be drawn
   *  around the marker rather than around the moment it was clicked. */
  const satEpochRef = useRef<number | null>(null);
  const [selectedSat, setSelectedSat] = useState<SatelliteDetail | null>(null);

  /** Drops the selection: the ring, the orbit track and the readout together.
   *  Leaving any one of them behind is what made a closed popup look like a
   *  still-selected satellite. */
  const clearSat = useCallback(() => {
    if (satPickedRef.current === null && satSelectedIdRef.current === null) return;
    satPickedRef.current = null;
    satSelectedIdRef.current = null;
    satLayerRef.current?.setSelected(null);
    satLayerRef.current?.setOrbit(null);
    setSelectedSat(null);
  }, []);

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
  // The drawn route goes when its aircraft's card closes.
  const aircraftOpen = inspect.targets.filter(t => t.kind === 'aircraft').map(t => t.id).join(' ');
  useEffect(() => {
    const drawn = flightSelectRef.current?.drawn();
    if (drawn && !aircraftOpen.split(' ').includes(drawn)) flightSelectRef.current?.clear();
  }, [aircraftOpen]);
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
    const map = createMap(container);
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

    bindViewEvents(map, container, { onMouseCoords, onRightClick, onViewStateChange });

    // ── POPUP HELPER ──
    // While a draw tool owns the map, a click on a camera or ship is a vertex or a region, not a selection.
    const drawing = () => drawModeRef.current != null;
    const entityClick: WorldMapProps['onEntityClick'] = e => { if (!drawing()) onEntityClick?.(e); };
    const popup = (coords: any, html: string) => {
      if (drawing()) return;
      popupRef.current?.remove();
      popupRef.current = new maplibregl.Popup({ closeButton: true, maxWidth: '420px', offset: 14 }).setLngLat(coords).setHTML(html).addTo(map);
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
    const onEmpty = () => { if (!drawing() && isMobileRef.current) { inspectRef.current.closeAll(); clearSat(); } };
    // What already has a window gets no tooltip.
    const hoverTip = bindHoverTip(map, key => !!windowStore.find(key)
      || inspectRef.current.targets.some(t => inspectId(t) === key) || (!!satSelectedIdRef.current && key === `satellite:${satSelectedIdRef.current}`), drawing);
    const cancelSatHover = bindSatellitePick(map, { satLayerRef, oiGlobeRef, satRowsRef, satPickedRef, satSelectedIdRef, satEpochRef, popupRef, paletteRef, setSelectedSat, onEmpty, onHover: row => hoverTip.setSatellite(row) });
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
      cancelSatHover();
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
  useMapPalette({ mapRef, mapReady, theme, palette, setPalette, oiGlobeRef });

  // ── DECOUPLED LAYER RENDERERS (Performance Optimized) ──

  useEarthquakeLayer(layerArgs);
  useSatelliteLayer({ ...layerArgs, palette, satLayerRef, satRowsRef, satPickedRef, satSelectedIdRef, satEpochRef, setSelectedSat, clearSat });
  useIncidentLayers(layerArgs);
  useCyberLayers(layerArgs);
  useCctvLayer(layerArgs);
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
  useAirportDelaysLayer(layerArgs);
  useChokepointFlowLayer(layerArgs);
  useOutbreaksLayer(layerArgs);
  useWeatherGridLayer(layerArgs);
  useSdkLinks(layerArgs);
  useLiveNewsLayer(layerArgs);
  useAlertPins({ ...layerArgs, alertPinsRef, alertPinIds });
  useConflictZones(layerArgs);
  useLayerVisibility({ mapRef, mapReady, activeLayers, setVis, satRowsRef, satLayerRef, replayActive: !!replay || !!history });
  useReplayLayer({ mapRef, mapReady, replay, activeLayers });
  useChoroplethLayer({ mapRef, mapReady, history, mapStyle });
  useWarLayers({ mapRef, mapReady, history, popupRef });
  usePaleoLayer({ mapRef, mapReady, history, mapStyle });
  const eventFamilies = useMemo(() => (history ? historyFamilies : replay && activeLayers.earthquakes ? QUAKES : NO_FAMILIES),
    [history, historyFamilies, replay, activeLayers.earthquakes]);
  useHistoryLayer({ mapRef, mapReady, timeline: history ?? replay, families: eventFamilies, popupRef });
  useReconLayers({ ...layerArgs, sweepData, scanTargets });
  useReferenceLayers(layerArgs);

  // Projection changes are independent of terrain. Toggling elevation must not
  // zoom, tilt, or reposition the camera the user has already chosen.
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    const map = mapRef.current;
    try {
      const projectionChanged = applyMapProjection(map, projection, terrainEnabled);
      const configureSky = projectionChanged || !containerRef.current?.dataset.mapProjection;
      if (containerRef.current) containerRef.current.dataset.mapProjection = projection;
      if (projection === 'globe') {
        // The overview globe's resting tilt, which used to be the initial
        // pitch. Only on a real projection change, so toggling terrain never
        // re-tilts a camera the user has already placed.
        if (configureSky && map.getPitch() < 0.5) map.easeTo({ pitch: 20, duration: 1200 });
        try {
          if (configureSky) map.setSky({
            'sky-color': '#04040A',
            'sky-horizon-blend': 0.5,
            'horizon-color': '#0a0a1a',
            'horizon-fog-blend': 0.3,
            'fog-color': '#04040A',
            'fog-ground-blend': 0.9,
          });
        } catch (e) { console.warn('[TAKIP] Suppressed error:', e instanceof Error ? e.message : e); }
      } else {
        if (map.getPitch() > 0.5) map.easeTo({ pitch: 0, duration: 350 });
      }
    } catch (e) {
      console.warn('Projection switch failed:', e);
    }
  }, [mapReady, projection, terrainEnabled]);

  // Terrain loads only at regional zooms; globe overview stays inexpensive.
  useEffect(() => {
    if (!mapReady || !mapRef.current || !terrainEnabled) return;
    const map = mapRef.current;
    installTerrainTileProtocol(maplibregl.addProtocol);
    const dispose = attachTerrain(map, status => onTerrainStatusChange?.(status));
    return () => {
      // The map constructor effect removes the entire map first on unmount.
      if (mapRef.current === map) dispose();
    };
  }, [mapReady, terrainEnabled, terrainRetry, onTerrainStatusChange]);

  // A user-requested close-up keeps the current location and avoids a fly-out arc.
  useEffect(() => {
    if (!mapReady || !mapRef.current || !terrainFocus || !terrainEnabled || lastTerrainFocus.current === terrainFocus) return;
    lastTerrainFocus.current = terrainFocus;
    const map = mapRef.current;
    map.easeTo({ zoom: Math.max(10.5, map.getZoom()), pitch: 45, duration: 650 });
  }, [mapReady, terrainFocus, terrainEnabled]);

  useFlyTo({ mapRef, mapReady, flyToLocation, openAlertPinRef });
  useBasemapStyle({ mapRef, mapReady, activeLayers, mapStyle });
  useBasemapProviderSource({ mapRef, mapReady });
  useBasemapDetail({ mapRef, mapReady });
  useWeatherRasters({ mapRef, mapReady, data, activeLayers, mapStyle, cloudLayerRef });
  useHikingLayer({ mapRef, mapReady, activeLayers, mapStyle });
  useHikingPick({ mapRef, mapReady, activeLayers, popupRef, drawModeRef, oiGlobeRef, satPickedRef });
  usePlacePick({ mapRef, mapReady, popupRef, drawModeRef, oiGlobeRef, satPickedRef });

  // TAKIP OI — a prediction drawn as it happens: actors, the events of the
  // simulated worlds and arcs through the sky (see lib/oi/globe). The page feeds it
  // run state directly, so the map does not re-render on every event; the
  // layer re-adds itself after a style change.
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    const globe = attachOi(mapRef.current, {
      onSelect: key => onOiSelectRef.current?.(key),
      onHover: hover => onOiHoverRef.current?.(hover),
      onFollowChange: following => onOiFollowRef.current?.(following),
    });
    globe.setColors({ support: paletteRef.current.oiSupport, oppose: paletteRef.current.oiOppose, neutral: paletteRef.current.oiNeutral });
    oiGlobeRef.current = globe;
    onOiGlobeRef.current?.(globe);
    return () => {
      oiGlobeRef.current = null;
      onOiGlobeRef.current?.(null);
      globe.destroy();
    };
  }, [mapReady]);

  useOiHighlights({ mapRef, mapReady, oiHighlight });
  useDrawnPolygons({ mapRef, mapReady, drawnPolygons, prevDrawnPolygonsRef });
  useDirections({ mapRef, mapReady, route });
  useUserLocation({ mapRef, mapReady, userLocation, followUser, onFollowInterrupt, navigating });

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
        <InspectHost mapRef={mapRef} data={data} targets={inspect.targets} sat={selectedSat}
          onClose={inspect.close} onCloseAll={inspect.closeAll} onCloseSat={clearSat} onSelectFlight={selectWatched} />
      )}
      {mapReady && <SelectionRings mapRef={mapRef} />}
      {mapReady && <CameraLeaders mapRef={mapRef} />}
      <WindowLayer />
      {mapReady && <MapControls mapRef={mapRef} onInteract={onFollowInterrupt} replayActive={!!replay} onReplayToggle={onReplayToggle} />}
    </>
  );
}

export default memo(WorldMap);
