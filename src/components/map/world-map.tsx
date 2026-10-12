'use client';

import { useEffect, useRef, useState, useCallback, memo } from 'react';
import * as maplibregl from 'maplibre-gl';
import { installTerrainTileProtocol } from '@/lib/terrain-tiles';
import { createCloudLayer } from '@/lib/live-clouds-layer';
import { attachOi, type OiGlobe } from '@/lib/oi/globe';
import { createSatelliteLayer } from '@/lib/satellite-layer';
import { MAP_DEFAULTS, type MapPalette } from '@/lib/map-palette';
import SatelliteCard, { type SatelliteDetail } from './satellite-card';
import CctvPreviews, { type PreviewCamera } from '@/components/cameras/cctv-previews';
import MapControls from './map-controls';
import LiveNewsPreviews, { type PreviewFeed } from '@/components/cameras/live-news-previews';
import { attachTerrain } from '@/lib/map-terrain';
import { applyMapProjection } from '@/lib/map-projection';
import type { AlertPinFeature } from '@/lib/map-alert-pins';
import { addBaseLayers } from '@/lib/map-base-layers';
import { createMap } from '@/lib/map-create';
import { bindAlertPins } from './world-map/bind-alert-pins';
import { bindCctvAndQuakeClicks, bindFeaturePopups } from './world-map/bind-feature-popups';
import { bindFlightClicks } from './world-map/bind-flight-clicks';
import { bindSatellitePick } from './world-map/bind-satellite-pick';
import { bindViewEvents } from './world-map/bind-view-events';
import type { SatelliteRow, WorldMapProps } from './world-map/types';
import { useBasemapStyle, useDayNight } from './world-map/use-basemap';
import { useDemoSpin, useFlyTo, useMapCenter } from './world-map/use-camera';
import { useDrawing } from './world-map/use-drawing';
import { useConflictZones, useEarthquakeLayer, useIncidentLayers } from './world-map/use-event-layers';
import { useFlightLayers, useWatchedAirports } from './world-map/use-flight-layers';
import { useLayerVisibility } from './world-map/use-layer-visibility';
import { useMapPalette } from './world-map/use-map-palette';
import { useDirections, useUserLocation } from './world-map/use-navigation';
import { useCyberLayers, useSdkLinks } from './world-map/use-network-layers';
import { useAlertPins, useLiveNewsLayer } from './world-map/use-news-layers';
import { useOiHighlights } from './world-map/use-oi-highlights';
import { useArcgisLayers, useDrawnPolygons } from './world-map/use-overlay-layers';
import { useBalloonLayer, useCctvLayer, useInfrastructureLayer, useMaritimeLayers, useNaturalEventLayers, useRadiationLayer } from './world-map/use-point-layers';
import { useReconLayers } from './world-map/use-recon-layers';
import { useReferenceLayers } from './world-map/use-reference-layers';
import { useSatelliteDismiss, useSatelliteLayer } from './world-map/use-satellite-layer';
import { useWeatherGridLayer, useWeatherRasters } from './world-map/use-weather-layers';
import 'maplibre-gl/dist/maplibre-gl.css';

function WorldMap({ data, activeLayers, onEntityClick, onMouseCoords, onRightClick, onViewStateChange, onReady, flyToLocation, alertPinIds = null, projection = 'globe', terrainEnabled = false, terrainRetry = 0, terrainFocus = 0, onTerrainStatusChange, mapStyle = 'dark', sweepData, scanTargets = [], demoMode = false, theme = 'core', drawnPolygons = [], arcgisLayers = [], drawMode = null, onDrawComplete, onDrawProgress, onDrawCancel, drawCommand = null, onMapCenter, route = null, userLocation = null, followUser = false, onFollowInterrupt, navigating = false, aircraftAirports = {}, onOiGlobe, onOiSelect, onOiHover, onOiFollow, oiHighlight = null }: WorldMapProps) {
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
  const drawingCoordsRef = useRef<number[][]>([]);

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
      if (process.env.NODE_ENV === 'development') (window as any).__osirisMap = map;
    });

    bindViewEvents(map, container, { onMouseCoords, onRightClick, onViewStateChange });

    // ── POPUP HELPER ──
    const popup = (coords: any, html: string) => {
      popupRef.current?.remove();
      popupRef.current = new maplibregl.Popup({ closeButton: true, maxWidth: '420px', offset: 14 }).setLngLat(coords).setHTML(html).addTo(map);
    };

    bindFlightClicks(map, popup, popupRef);
    bindCctvAndQuakeClicks(map, popup, onEntityClick);
    const cancelSatHover = bindSatellitePick(map, { satLayerRef, oiGlobeRef, satRowsRef, satPickedRef, satSelectedIdRef, satEpochRef, popupRef, paletteRef, setSelectedSat, clearSat });
    bindFeaturePopups(map, popup, onEntityClick);
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
  useRadiationLayer(layerArgs);
  useWeatherGridLayer(layerArgs);
  useSdkLinks(layerArgs);
  useLiveNewsLayer(layerArgs);
  useAlertPins({ ...layerArgs, alertPinsRef, alertPinIds });
  useConflictZones(layerArgs);
  useLayerVisibility({ mapRef, mapReady, activeLayers, setVis, satRowsRef, satLayerRef });
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
        } catch (e) { console.warn('[OSIRIS] Suppressed error:', e instanceof Error ? e.message : e); }
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
  useWeatherRasters({ mapRef, mapReady, data, activeLayers, mapStyle, cloudLayerRef });

  // OSIRIS OI — a prediction drawn as it happens: actors, the events of the
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

  useWatchedAirports({ mapRef, mapReady, aircraftAirports });
  useArcgisLayers({ mapRef, mapReady, arcgisLayers, prevArcgisLayersRef });
  useDrawing({ mapRef, mapReady, drawMode, drawCommand, onDrawComplete, onDrawProgress, onDrawCancel, drawingCoordsRef });
  useMapCenter({ mapRef, mapReady, onMapCenter });
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
      {selectedSat && <SatelliteCard sat={selectedSat} onClose={clearSat} />}
      {mapReady && <MapControls mapRef={mapRef} onInteract={onFollowInterrupt} />}
    </>
  );
}

export default memo(WorldMap);
