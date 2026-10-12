'use client';

import { useEffect, useState, useRef, useCallback, useMemo, type Dispatch, type SetStateAction } from 'react';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'framer-motion';
import { Route, Radar, AlertTriangle, Database, Radio, PenLine, Layers } from 'lucide-react';
import { type TerrainStatus } from '@/lib/map-terrain';
import IntelFeed from '@/components/alerts/intel-feed';
import MarketsPanel from '@/components/markets/markets-panel';
import SearchBar from '@/components/search/search-bar';
import DirectionsBar, { type LiveLocation } from '@/components/directions/directions-bar';
import type { NavProgress } from '@/lib/navigation';
import ErrorBoundary from '@/components/ui/error-boundary';
import { applySettings, loadSavedSettings } from '@/lib/style-tokens';
import SharePanel from '@/components/shell/share-panel';
import ViewPresets from '@/components/map/view-presets';
import KeyboardShortcuts from '@/components/shell/keyboard-shortcuts';
import GlobalStatusBar from '@/components/shell/global-status-bar';
import LiveAlerts from '@/components/alerts/live-alerts';
import ArcGISPanel from '@/components/layers/arcgis-panel';
const WorldMap = dynamic(() => import('@/components/map/world-map'), { ssr: false });
const LayerPanel = dynamic(() => import('@/components/layers/layer-panel'));
const LayersPane = dynamic(() => import('@/components/layers/layers-pane'));
const SpaceCam = dynamic(() => import('@/components/cameras/space-cam'), { ssr: false });
const CameraViewer = dynamic(() => import('@/components/cameras/camera-viewer'));
const OsintPanel = dynamic(() => import('@/components/recon/osint-panel'));
const OiPanel = dynamic(() => import('@/components/oi/oi-panel'));
const DrawingToolbar = dynamic(() => import('@/components/draw/drawing-toolbar'), { ssr: false });
const DrawHud = dynamic(() => import('@/components/draw/draw-hud'), { ssr: false });
// The measurement helpers are pure functions — importing them directly keeps
// them out of the lazy chunk, so a finished polygon can be measured whether or
// not the toolbar has loaded yet.
import { toShape, queryArea, type DrawMode, type DrawnShape, type DrawProgress, type DrawResult } from '@/lib/draw';
import { selectInArea } from '@/lib/aoi';
import { pickLandingCity } from '@/lib/landing-cities';
import { loadLayers } from '@/lib/saved-layers';
import { diffSweep, appendEvents, type WatchBaseline, type WatchEvent } from '@/lib/watch';
import { STORAGE_KEY, serializeShapes, deserializeShapes, shapesToGeoJSON, downloadFile } from '@/lib/aoi-export';
import { Dock, DOCK_WIDTH, NAV_WIDTH, type ToolId } from '@/components/shell/dock';
import { NavSidebar, type NavItem } from '@/components/shell/nav-sidebar';
import PanelCard from '@/components/shell/panel-card';
import MapOptions from '@/components/shell/map-options';
import MoreMenu from '@/components/shell/more-menu';
import AccountButton from '@/components/account/account-button';
import { LAYER_GROUPS, primary } from '@/components/layers/layer-groups';
import { DEFAULT_LAYERS } from '@/lib/default-layers';
import { newsTransform } from '@/lib/news-transform';
import { hudIn } from '@/lib/hud-motion';
import type { ActiveRoute, BackendStatus, FlyToTarget, LiveData, MapCenter, MapProjection, MapStyle, MobilePanel, NavSession } from '@/components/shell/dashboard-types';
import { useIsMobile } from '@/components/shell/use-is-mobile';
import { useLiveData } from '@/components/shell/use-live-data';
import { useMalwareStream } from '@/components/shell/use-malware-stream';
import { useSdkEntities } from '@/components/shell/use-sdk-entities';
import { useKeyboardShortcuts } from '@/components/shell/use-keyboard-shortcuts';
import { useLayerPersistence } from '@/components/shell/use-layer-persistence';
import { useFlightWatch } from '@/components/flights/use-flight-watch';
import { useOiSession } from '@/components/oi/use-oi-session';
import { useOiAssist } from '@/components/oi/use-oi-assist';
import SplashScreen from '@/components/shell/splash-screen';
import AppHeader from '@/components/shell/app-header';
import { LiveStats, MobileStatus } from '@/components/shell/status-cluster';
import ViewControls from '@/components/shell/view-controls';
import CursorInfo from '@/components/shell/cursor-info';
import MobileNav from '@/components/shell/mobile-nav';
import { MobileDrawer, MobileStats } from '@/components/shell/mobile-drawer';
import SearchSpotlight from '@/components/search/search-spotlight';
import NavigationBanner from '@/components/directions/navigation-banner';
import FlightWatchOverlay from '@/components/flights/flight-watch-overlay';
import OiHoverCard from '@/components/oi/oi-hover-card';
import LiveFeedModal from '@/components/cameras/live-feed-modal';
import RegionDossier from '@/components/map/region-dossier';
import AccountDialog from '@/components/account/account-dialog';

export default function Dashboard() {
  const dataRef = useRef<LiveData>({});
  const [dataVersion, setDataVersion] = useState(0);
  const data = dataRef.current;

  const [backendStatus, setBackendStatus] = useState<BackendStatus>('connecting');
  const [mapView, setMapView] = useState({ zoom: 2.5, latitude: 20 });
  const [flyToLocation, setFlyToLocation] = useState<FlyToTarget | null>(null);
  /* The Live Alerts the feed's filters leave showing; the map pins those. */
  const [pinnedAlertIds, setPinnedAlertIds] = useState<string[] | null>(null);
  const [globalStats, setGlobalStats] = useState<any>(null);
  const mouseCoordsRef = useRef<{ lat: number; lng: number } | null>(null);
  const coordsDisplayRef = useRef<HTMLDivElement>(null);
  const [locationLabel, setLocationLabel] = useState('');
  const [regionDossier, setRegionDossier] = useState<any>(null);
  const [dossierLoading, setDossierLoading] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const [splashStage, setSplashStage] = useState(0);
  const [mapReady, setMapReady] = useState(false);

  const revealed = !showSplash;
  /* True once the splash has finished fading out, not merely started to. */
  const [splashGone, setSplashGone] = useState(false);
  /* Where the viewer is, by IP. Asked for at once; the camera flies there
     once the splash has gone. */
  const [homeLocation, setHomeLocation] = useState<{ lat: number; lng: number } | null>(null);
  const autoLocateCancelled = useRef(false);

  const [activeCamera, setActiveCamera] = useState<any>(null);
  const [spaceWeather, setSpaceWeather] = useState<any>(null);
  /** The panel open beside the sidebar, if any. */
  const [activeTool, setActiveTool] = useState<ToolId | null>(null);
  /** Layers is a sidebar panel; TI and the L key still switch it like the old rail. */
  const setShowLayers: Dispatch<SetStateAction<boolean>> = useCallback(v => setActiveTool(cur => {
    const on = typeof v === 'function' ? v(cur === 'layers') : v;
    return on ? 'layers' : cur === 'layers' ? null : cur;
  }), []);
  const [drawMode, setDrawMode] = useState<DrawMode | null>(null);
  const [drawProgress, setDrawProgress] = useState<DrawProgress | null>(null);
  const [drawCommand, setDrawCommand] = useState<{ action: 'undo' | 'finish' | 'cancel'; seq: number } | null>(null);
  const sendDraw = useCallback((action: 'undo' | 'finish' | 'cancel') => {
    setDrawCommand(c => ({ action, seq: (c?.seq ?? 0) + 1 }));
  }, []);
  /** AOIs whose contents are being watched for arrivals and departures. */
  const [watched, setWatched] = useState<Set<string>>(new Set());
  const [watchEvents, setWatchEvents] = useState<WatchEvent[]>([]);
  const watchBaselines = useRef<Record<string, WatchBaseline>>({});
  const [selectedPolygon, setSelectedPolygon] = useState<string | null>(null);
  const [showDesktopSearch, setShowDesktopSearch] = useState(false);
  // The planner is mounted; it stays mounted while another tool has the dock, so the route survives.
  const [showDirections, setShowDirections] = useState(false);
  // A destination Search hands to Directions ("Directions to here"); its stamp remounts the planner with it.
  const [routeTarget, setRouteTarget] = useState<{ label: string; context?: string; lat: number; lng: number; kind?: string; ts: number } | null>(null);
  const [activeRoute, setActiveRoute] = useState<ActiveRoute | null>(null);
  const [liveLocation, setLiveLocation] = useState<LiveLocation | null>(null);
  const [followUser, setFollowUser] = useState(false);
  const [navSession, setNavSession] = useState<NavSession | null>(null);
  const [navProgress, setNavProgress] = useState<NavProgress | null>(null);
  const { watchedFlights, aircraftAirports, removeWatched, handleAircraftDetail, watchTelemetry } = useFlightWatch(data);

  // A navigation session owns its own position watch. The planner's watch dies
  // with the planner when guidance takes over the panel, so guidance cannot
  // depend on it — without this the banner sits on "waiting for a fix" forever.
  useEffect(() => {
    if (!navSession) return;
    if (typeof navigator === 'undefined' || !navigator.geolocation) return;
    const id = navigator.geolocation.watchPosition(
      (pos) => setLiveLocation({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
        heading: pos.coords.heading,
      }),
      () => { /* the view already explains the HTTPS requirement */ },
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 15000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [navSession]);
  const [arcgisLayers, setArcgisLayers] = useState<Array<{ id: string; title: string; url: string; geojson: any; color: string; visible: boolean; opacity: number }>>([]);
  const [mapCenter, setMapCenter] = useState<MapCenter | null>(null);
  const [mobilePanel, setMobilePanel] = useState<MobilePanel | null>(null);

  const {
    oi, oiSelected, setOiSelected, oiHover, setOiHover, oiFollowing, setOiFollowing, oiTheater, setOiTheater,
    oiMode, setOiMode, oiStage, setOiStage, oiAutoFocus, setOiAutoFocus, oiGlobe,
    handleOiGlobe, handleOiSelect, handleOiLocate, followOi,
  } = useOiSession({ mobilePanel, setMobilePanel, setActiveTool, setFlyToLocation });
  // A shared link (?oi=<run>) opens the panel on that run, and the camera
  // goes to the run rather than to the visitor's city.
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('oi');
    if (!id) return;
    autoLocateCancelled.current = true;
    setOiMode('forecast');
    if (window.matchMedia('(max-width: 767px)').matches) setMobilePanel('oi');
    else setActiveTool('oi');
    void oi.watch(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Once a run is under way the camera is the director's (lib/oi/camera): a late answer about the
  // visitor's city must not fly it away.
  useEffect(() => { if (oi.runId) autoLocateCancelled.current = true; }, [oi.runId]);
  const [mapProjection, setMapProjection] = useState<MapProjection>('globe');
  const [terrainFocus, setTerrainFocus] = useState(0);
  const [terrainStatus, setTerrainStatus] = useState<TerrainStatus>('idle');
  const [terrainRetry, setTerrainRetry] = useState(0);
  const [mapStyle, setMapStyle] = useState<MapStyle>('dark');
  const [sweepData, setSweepData] = useState<any>(null);
  const [scanTargets, setScanTargets] = useState<any[]>([]);
  const [drawnPolygons, setDrawnPolygons] = useState<DrawnShape[]>([]);
  const [takipTheme, setTakipTheme] = useState<'core'|'ghost'>('core');

  useEffect(() => {
    document.body.className = takipTheme === 'core' ? '' : `theme-${takipTheme}`;
  }, [takipTheme]);

  /* Style Studio overrides are inline on <body>, so they survive the theme
     swap above and only need reapplying once per load. */
  useEffect(() => {
    const saved = loadSavedSettings();
    if (saved) applySettings(saved);
  }, []);

  const isMobile = useIsMobile();
  const startTime = useRef(Date.now());
  const geocodeCache = useRef<Map<string, string>>(new Map());
  const geocodeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastGeocodedPos = useRef<{ lat: number; lng: number } | null>(null);

  const [activeLayers, setActiveLayers] = useState(DEFAULT_LAYERS);
  const { oiHighlight, oiVoice, setOiVoicePersist, assist } = useOiAssist({
    dataRef, oi, oiGlobe, activeLayers, setActiveLayers, mapCenter, mapView, mapProjection, setMapProjection, mapStyle, setMapStyle,
    oiTheater, setOiTheater, oiStage, setOiStage, setOiMode, setOiSelected,
    setMobilePanel, setActiveTool, setShowLayers, setShowDirections, setFlyToLocation, setActiveCamera,
  });

  // Server-side capability flags — gate layers that need credentials.
  const selectFlatMap = () => {
    setActiveLayers(prev => ({ ...prev, terrain_elevation: false, terrain_3d: false }));
    setMapProjection('mercator');
  };
  const terrainPanelProps = {
    terrainStatus,
    on3DModeSelected: () => setMapProjection('globe'),
    onTerrainRetry: () => setTerrainRetry(value => value + 1),
    onTerrainFocus: () => setTerrainFocus(value => value + 1),
  };
  const [capabilities, setCapabilities] = useState<Record<string, boolean>>({});
  const [liveFeedUrl, setLiveFeedUrl] = useState<string | null>(null);
  const [liveFeedName, setLiveFeedName] = useState('');
  const [liveFeedEmbedAllowed, setLiveFeedEmbedAllowed] = useState(true);

  /* Splash: it lifts once the map has drawn its first frame. It never lifts
     before the intro has played (about 2.2 s), and never later than 7 s, so a
     machine that cannot start the map still reaches the platform. */
  useEffect(() => {
    const timers = [
      setTimeout(() => setSplashStage(s => Math.max(s, 1)), 1100),
      setTimeout(() => setSplashStage(s => Math.max(s, 2)), 1700),
      setTimeout(() => setShowSplash(false), 7000),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);
  useEffect(() => {
    if (!mapReady || splashStage !== 2) return;
    const t = setTimeout(() => setSplashStage(3), 500);
    return () => clearTimeout(t);
  }, [mapReady, splashStage]);
  useEffect(() => {
    if (splashStage !== 3) return;
    // Long enough to read SYSTEM READY before the splash goes.
    const t = setTimeout(() => setShowSplash(false), 550);
    return () => clearTimeout(t);
  }, [splashStage]);

  /* Fly from the globe down to the viewer's city once the splash has gone.
     Starting as it began to fade meant a busy first load (the satellite
     catalogue is ~19k objects) could hold the fade until the camera was
     nearly at street level, and the globe was never seen. */
  useEffect(() => {
    if (!splashGone || !homeLocation || autoLocateCancelled.current) return;
    setFlyToLocation({ ...homeLocation, zoom: 8, duration: 3500, ts: Date.now() });
  }, [splashGone, homeLocation]);

  // On mount: restore layers, probe optional feeds, and geolocate by IP
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // A shared link's layers win over the ones this browser remembers.
    const p = new URLSearchParams(window.location.search);
    const layers = p.get('layers');
    if (layers !== null) {
      const active = layers.split(',');
      // Links from before the vessel filters existed name none of them; keep the defaults then.
      const linkSetsShips = active.some(k => k.startsWith('ships_'));
      setActiveLayers(prev => {
        const next = { ...prev };
        Object.keys(next).forEach(k => {
          if (k.startsWith('ships_') && !linkSetsShips) return;
          (next as any)[k] = active.includes(k);
        });
        return next;
      });
    } else {
      setActiveLayers(prev => ({ ...prev, ...loadLayers(prev) }));
    }

    // Probe which credential-gated feeds this deployment has configured, so the
    // layer panel can hide toggles that could never return data.
    fetch('/api/cloudflare-radar?probe=1')
      .then(r => (r.ok ? r.json() : null))
      .then(p => { if (p) setCapabilities(c => ({ ...c, cloudflare: !!p.configured })); })
      .catch(() => { /* leave the layer hidden */ });
    // Reference layers need data/reference/ on this server (see its README).
    fetch('/api/reference')
      .then(r => (r.ok ? r.json() : null))
      .then(p => { if (p) setCapabilities(c => ({ ...c, reference: !!p.available })); })
      .catch(() => { /* leave the layers hidden */ });

    // Once the user interacts, a late IP-location response must not steal the
    // camera back. The request is also cancelled when this page unmounts.
    const geoController = new AbortController();
    const cancelAutoLocate = () => { autoLocateCancelled.current = true; };
    window.addEventListener('pointerdown', cancelAutoLocate, { once: true });
    window.addEventListener('keydown', cancelAutoLocate, { once: true });
    /* Asked for at once rather than after a fixed 3 s wait, so the answer is
       in hand when the splash lifts; the effect above does the flying. When
       the visitor's city can't be found (no public address, every provider
       failed, or no answer within 6 s) the fly-in still happens, to a random
       well-covered city, rather than stopping on the globe. */
    let located = false;
    const landSomewhere = () => {
      if (located || geoController.signal.aborted) return;
      located = true;
      const city = pickLandingCity();
      setHomeLocation({ lat: city.lat, lng: city.lng });
    };
    const geoGiveUp = setTimeout(landSomewhere, 6000);
    fetch('/api/geo', { signal: geoController.signal })
      .then(r => r.json())
      .then(geo => {
        if (located || geoController.signal.aborted) return;
        if (geo.status === 'success' &&
            Number.isFinite(geo.lat) && Number.isFinite(geo.lon) && Math.abs(geo.lat) <= 90 && Math.abs(geo.lon) <= 180) {
          located = true;
          setHomeLocation({ lat: geo.lat, lng: geo.lon });
        } else {
          landSomewhere();
        }
      })
      .catch(landSomewhere);

    return () => {
      clearTimeout(geoGiveUp);
      geoController.abort();
      window.removeEventListener('pointerdown', cancelAutoLocate);
      window.removeEventListener('keydown', cancelAutoLocate);
    };
  }, []);

  const { oiFocus, toggleOiFocus } = useLayerPersistence({ activeLayers, setActiveLayers });

  // Global Stats Fetch
  useEffect(() => {
    fetch('/api/stats')
      .then(res => res.json())
      .then(d => {
        if (d.stats) setGlobalStats(d.stats);
      })
      .catch(console.error);
  }, []);

  /** From Search: open Directions with this place as the destination, and show where it is. */
  const openDirectionsTo = useCallback((p: { label: string; context?: string; lat: number; lng: number; kind?: string }) => {
    setRouteTarget({ ...p, ts: Date.now() });
    setActiveRoute(null);
    setShowDesktopSearch(false);
    setMobilePanel(null);
    setShowDirections(true);
    setActiveTool('directions');
    setFlyToLocation({ lat: p.lat, lng: p.lng, zoom: 14, ts: Date.now() });
  }, []);

  useKeyboardShortcuts({
    setShowDesktopSearch, setActiveTool, setOiMode, setOiAutoFocus, setMobilePanel, setShowLayers, setFlyToLocation, setActiveLayers, setMapProjection,
  });

  // Mouse coords + reverse geocode (Zero-Render)
  const handleMouseCoords = useCallback((coords: { lat: number; lng: number }) => {
    mouseCoordsRef.current = coords;
    if (coordsDisplayRef.current) {
      coordsDisplayRef.current.innerText = `${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`;
    }
    if (geocodeTimer.current) clearTimeout(geocodeTimer.current);
    geocodeTimer.current = setTimeout(async () => {
      if (lastGeocodedPos.current) {
        const d = Math.abs(coords.lat - lastGeocodedPos.current.lat) + Math.abs(coords.lng - lastGeocodedPos.current.lng);
        if (d < 0.5) return; // increased threshold — fewer geocode calls
      }
      const gk = `${coords.lat.toFixed(1)},${coords.lng.toFixed(1)}`; // coarser grid = more cache hits
      if (geocodeCache.current.has(gk)) { setLocationLabel(geocodeCache.current.get(gk)!); lastGeocodedPos.current = coords; return; }
      try {
        /* Our own route, not Nominatim directly: it rounds the coordinate,
           caches the answer for everyone, and holds the app's request budget
           for the service — see lib/nominatim.ts. */
        const res = await fetch(`/api/geo/reverse?lat=${coords.lat}&lng=${coords.lng}`);
        if (res.ok) {
          const d = await res.json();
          const label = d.label || 'Unknown';
          if (geocodeCache.current.size > 500) { const it = geocodeCache.current.keys(); for (let i=0;i<100;i++) { const k = it.next().value; if(k) geocodeCache.current.delete(k); }}
          geocodeCache.current.set(gk, label);
          setLocationLabel(label);
          lastGeocodedPos.current = coords;
        }
      } catch (e) { console.warn('[TAKIP] Suppressed error:', e instanceof Error ? e.message : e); }
    }, 3000); // 3s debounce (was 1.5s)
  }, []);

  // Region dossier (double right-click)
  const handleRightClick = useCallback(async (coords: { lat: number; lng: number }) => {
    setDossierLoading(true); setRegionDossier(null);
    try {
      const res = await fetch(`/api/region-dossier?lat=${coords.lat}&lng=${coords.lng}`);
      if (res.ok) setRegionDossier(await res.json());
    } catch (e) { console.warn('[TAKIP] Suppressed error:', e instanceof Error ? e.message : e); } finally { setDossierLoading(false); }
  }, []);
  // Entity click handler (hoisted from JSX to comply with Rules of Hooks - Fixes #113)
  const handleEntityClick = useCallback((entity: any) => {
    if (entity?.type === 'cctv') setActiveCamera(entity);
    if (entity?.type === 'live_news' && entity.url) {
      setLiveFeedUrl(entity.url);
      setLiveFeedName(entity.name);
      setLiveFeedEmbedAllowed(entity.embed_allowed !== false);
    }
  }, []);

  // ── Drawing / AOI ──
  // WorldMap already owns the draw interaction and the polygon rendering;
  // this only turns a finished ring into a measured, named, coloured record.
  // Restore drawn areas on load. Work that vanishes on refresh is work the
  // operator will not trust the tool with.
  useEffect(() => {
    try {
      const restored = deserializeShapes(localStorage.getItem(STORAGE_KEY));
      if (restored.length) setDrawnPolygons(restored);
    } catch { /* storage unavailable — start empty */ }
  }, []);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, serializeShapes(drawnPolygons)); } catch { /* quota or private mode */ }
  }, [drawnPolygons]);

  // ── Tripwires ──
  // Re-sweep every watched AOI whenever live data refreshes and record what
  // changed. Keyed off dataVersion rather than `data` so this runs once per
  // refresh instead of once per render.
  useEffect(() => {
    if (watched.size === 0) return;
    const now = Date.now();
    const fresh: WatchEvent[] = [];
    for (const shape of drawnPolygons) {
      if (!watched.has(shape.id)) continue;
      const area = queryArea(shape);
      if (!area) continue;
      const report = selectInArea(area, dataRef.current as any);
      const prev = watchBaselines.current[shape.id] ?? null;
      const { baseline, events } = diffSweep(shape.id, report, prev, now);
      watchBaselines.current[shape.id] = baseline;
      fresh.push(...events);
    }
    if (fresh.length) setWatchEvents(log => appendEvents(log, fresh));
  }, [dataVersion, watched, drawnPolygons]);

  const toggleWatch = useCallback((id: string) => {
    setWatched(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        // Drop the baseline too, so re-arming starts clean rather than
        // reporting everything that moved while the watch was off.
        delete watchBaselines.current[id];
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleDrawComplete = useCallback((result: DrawResult) => {
    setDrawnPolygons(prev => [toShape(result, prev, prev.length), ...prev]);
    // One shape per arming: staying armed after a finish is how you end up
    // with an accidental second AOI from the click that dismisses the first.
    setDrawMode(null);
    setDrawProgress(null);
  }, []);

  const handleExportGeoJSON = useCallback(() => {
    downloadFile(
      `takip-aoi-${new Date().toISOString().slice(0, 10)}.geojson`,
      JSON.stringify(shapesToGeoJSON(drawnPolygons), null, 2),
      'application/geo+json',
    );
  }, [drawnPolygons]);

  const { fetchEndpoint } = useLiveData({ dataRef, setDataVersion, setBackendStatus, setSpaceWeather, activeLayers });

  useMalwareStream({ dataRef, setDataVersion, setBackendStatus, activeLayers });

  useSdkEntities({ dataRef, data, dataVersion, activeLayers });

  const totalFlights = useMemo(() => (
    (data.commercial_flights?.length||0)+(data.private_flights?.length||0)+(data.private_jets?.length||0)+(data.military_flights?.length||0)
  ), [data.commercial_flights, data.private_flights, data.private_jets, data.military_flights]);


  const closeDirections = () => { setShowDirections(false); setActiveRoute(null); setRouteTarget(null); };
  const closeOi = () => { setActiveTool(null); setOiTheater(false); setOiAutoFocus(false); };
  /** A rail button: opens its tool in the dock, or closes the one already showing. */
  const toggleTool = (tool: ToolId) => {
    if (activeTool === tool) {
      if (tool === 'directions') closeDirections();
      if (tool === 'oi') closeOi();
      setActiveTool(null);
      return;
    }
    if (oiTheater) setOiTheater(false);
    if (tool === 'directions' && !showDirections) { setRouteTarget(null); setShowDirections(true); setShowDesktopSearch(false); }
    setActiveTool(tool);
  };
  const openTool = (tool: ToolId) => { if (activeTool !== tool) toggleTool(tool); };

  const layersOn = useMemo(
    () => primary(LAYER_GROUPS.filter(g => g.label !== 'DISPLAY').flatMap(g => g.layers)).filter(l => (activeLayers as Record<string, boolean>)[l.key]).length,
    [activeLayers],
  );
  const navItems: NavItem[] = [
    { id: 'layers', label: 'Layers', title: 'Layers: choose what the map shows (L)', icon: Layers, badge: layersOn },
    { id: 'draw', label: 'Areas', title: 'Areas: draw an area, see what is inside it, watch it for changes (D)', icon: PenLine },
    { id: 'alerts', label: 'Alerts', title: 'Live alerts: earthquakes, conflicts, breaking news (A)', icon: AlertTriangle },
    { id: 'recon', label: 'Recon', title: 'OSINT recon: IP lookup, network sweep, geolocation (I)', icon: Radar },
    { id: 'directions', label: 'Route', title: 'Directions: turn-by-turn routing', icon: Route },
    { id: 'space', label: 'Space', title: 'Live from space: the 24/7 ISS video downlink', icon: Radio },
    { id: 'arcgis', label: 'ArcGIS', title: 'ArcGIS: search and import geospatial layers', icon: Database, badge: arcgisLayers.length },
  ];
  /** Where the map's own controls start: right of the sidebar and of any panel open beside it. */
  const shellLeft = isMobile ? 0 : NAV_WIDTH + (activeTool && !oiTheater ? DOCK_WIDTH + 16 : 0);

  /* The planner renders in the dock on a desktop and at the top of a phone. It
     stays mounted underneath a running session: unmounting it would discard the
     route you are driving, so ending guidance would drop you into an empty form
     instead of back onto your route. */
  const planner = (
    <motion.div
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: navSession ? 0 : 1, y: 0 }}
      className={navSession ? 'pointer-events-none h-0 overflow-hidden' : ''}
      aria-hidden={Boolean(navSession)}
    >
      <DirectionsBar
        key={routeTarget?.ts ?? 'plan'}
        initialTo={routeTarget}
        center={mapCenter ? { lat: mapCenter.lat, lng: mapCenter.lng } : null}
        onRoute={(r) => setActiveRoute(r)}
        onLiveLocation={setLiveLocation}
        onFollowChange={setFollowUser}
        onActiveSegment={(seg) => setActiveRoute((r) => (r ? { ...r, activeSegment: seg } : r))}
        onStartNavigation={(r, label) => {
          setNavSession({ route: r, label, key: Date.now() });
          setFollowUser(true);
        }}
        onLocate={(lat, lng, zoom) => setFlyToLocation({ lat, lng, zoom, ts: Date.now() })}
        onClose={() => { closeDirections(); setActiveTool(t => (t === 'directions' ? null : t)); }}
      />
    </motion.div>
  );

  const dockTool = (tool: ToolId) => {
    switch (tool) {
      case 'layers': return (
        <PanelCard title="Layers" icon={Layers} onClose={() => setActiveTool(null)}
          meta={<span className="text-[11px] font-mono tabular-nums text-[var(--text-muted)]">{layersOn} on</span>}>
          <LayersPane data={data} activeLayers={activeLayers} setActiveLayers={setActiveLayers} capabilities={capabilities} />
        </PanelCard>
      );
      case 'oi': return (
        <OiPanel oi={oi} selected={oiSelected} onSelect={setOiSelected} onClose={closeOi}
          focus={oiFocus} onFocus={toggleOiFocus} onLocate={handleOiLocate}
          theater={oiTheater} onTheater={setOiTheater} following={oiFollowing} onFollow={followOi}
          assist={assist} mode={oiMode} onMode={setOiMode} speakOn={oiVoice} onSpeak={setOiVoicePersist} autoFocus={oiAutoFocus}
          stage={oiStage} onStage={setOiStage} />
      );
      case 'draw': return (
        <DrawingToolbar
          drawMode={drawMode}
          onSetDrawMode={setDrawMode}
          progress={drawProgress}
          polygons={drawnPolygons}
          onDeletePolygon={(id) => setDrawnPolygons(p => p.filter(x => x.id !== id))}
          onClearAll={() => { setDrawnPolygons([]); setSelectedPolygon(null); }}
          onExportGeoJSON={handleExportGeoJSON}
          selectedPolygon={selectedPolygon}
          onSelectPolygon={setSelectedPolygon}
          onRenamePolygon={(id, name) => setDrawnPolygons(p => p.map(x => x.id === id ? { ...x, name } : x))}
          data={data}
          onLocateEntity={(lat, lng) => setFlyToLocation({ lat, lng, zoom: 12, ts: Date.now() })}
          watched={watched}
          onToggleWatch={toggleWatch}
          watchEvents={watchEvents}
        />
      );
      case 'alerts': return (
        <LiveAlerts data={data} onLocate={(lat, lng, options) => setFlyToLocation({ lat, lng, zoom: options?.zoom, alertId: options?.alertId, ts: Date.now() })} pinsOn={activeLayers.alert_pins} onTogglePins={on => setActiveLayers(prev => ({ ...prev, alert_pins: on }))} onPinnedChange={setPinnedAlertIds} onWatchFeed={(url, name) => { setLiveFeedUrl(url); setLiveFeedName(name); }} onRefresh={() => fetchEndpoint('/api/news', newsTransform)} />
      );
      case 'recon': return (
        <OsintPanel onSweepVisualize={setSweepData} onScanGeolocate={(target, data) => {
          setScanTargets(prev => {
            const existing = prev.filter(t => t.id !== target);
            return [{ id: target, timestamp: Date.now(), ...data }, ...existing].slice(0, 10);
          });
          setFlyToLocation({ lat: data.lat, lng: data.lng, ts: Date.now() });
        }} />
      );
      case 'space': return <SpaceCam />;
      case 'arcgis': return (
        <div className="glass-panel p-3">
          <ArcGISPanel
            onImportLayer={(layer) => setArcgisLayers(prev => [...prev.filter(l => l.id !== layer.id), { ...layer, color: layer.color || '#D4AF37', visible: true, opacity: layer.opacity ?? 0.8 }])}
            onRemoveLayer={(id) => setArcgisLayers(prev => prev.filter(l => l.id !== id))}
            onUpdateLayer={(id, updates) => setArcgisLayers(prev => prev.map(l => l.id === id ? { ...l, ...updates } : l))}
            importedLayers={arcgisLayers}
            mapBounds={mapCenter?.bounds || null}
          />
        </div>
      );
      case 'markets': return <MarketsPanel data={data} spaceWeather={spaceWeather} />;
      default: return null;
    }
  };

  return (
    <main className="fixed inset-0 w-full h-full bg-[var(--bg-void)] overflow-hidden" style={{ '--shell-left': `${shellLeft}px` } as React.CSSProperties}>

      {/* ── SPLASH ── */}
      <SplashScreen showSplash={showSplash} splashStage={splashStage} setSplashGone={setSplashGone} />



      {/* ── MAP ── */}
      <ErrorBoundary name="Map">
        <WorldMap 
          key={takipTheme}
          data={data} 
          activeLayers={activeLayers} 
          projection={mapProjection === 'mercator' ? 'mercator' : 'globe'}
          terrainEnabled={activeLayers.terrain_elevation && mapProjection === 'globe'}
          terrainFocus={terrainFocus}
          terrainRetry={terrainRetry}
          onTerrainStatusChange={setTerrainStatus}
          mapStyle={mapStyle === 'satellite' ? 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}' : mapStyle === 'topo' ? 'topo' : 'dark'} 
          onEntityClick={handleEntityClick} 
          onMouseCoords={handleMouseCoords} 
          onRightClick={handleRightClick} 
          onViewStateChange={setMapView}
          onReady={() => setMapReady(true)}
          flyToLocation={flyToLocation}
          alertPinIds={pinnedAlertIds}
          sweepData={sweepData}
          scanTargets={scanTargets}
          theme={takipTheme}
          arcgisLayers={arcgisLayers.filter(l => l.visible).map(l => ({ id: l.id, title: l.title, geojson: l.geojson, color: l.color, opacity: l.opacity }))}
          onMapCenter={setMapCenter}
          route={activeRoute}
          userLocation={
            navSession && navProgress
              ? { lat: navProgress.snapped[1], lng: navProgress.snapped[0], accuracy: liveLocation?.accuracy, heading: liveLocation?.heading }
              : liveLocation
          }
          followUser={followUser}
          onFollowInterrupt={() => setFollowUser(false)}
          navigating={Boolean(navSession)}
          drawMode={drawMode}
          onDrawProgress={setDrawProgress}
          drawCommand={drawCommand}
          onDrawCancel={() => { setDrawMode(null); setDrawProgress(null); }}
          onDrawComplete={handleDrawComplete}
          drawnPolygons={drawnPolygons}
          aircraftAirports={aircraftAirports}
          onOiGlobe={handleOiGlobe}
          onOiSelect={handleOiSelect}
          onOiHover={setOiHover}
          onOiFollow={setOiFollowing}
          oiHighlight={oiHighlight}
        />
      </ErrorBoundary>

      {/* ── OI: what the pointer is over on the globe ── */}
      {oiHover && !isMobile && <OiHoverCard oiHover={oiHover} />}

      {/* ── NAVIGATION — a banner at the top; on a phone the planner opens here too ── */}
      <NavigationBanner navSession={navSession} setNavSession={setNavSession} liveLocation={liveLocation} setNavProgress={setNavProgress}
        followUser={followUser} setFollowUser={setFollowUser} setActiveRoute={setActiveRoute}>
        {isMobile && showDirections && planner}
      </NavigationBanner>

      {/* ── SEARCH — a field at the top of the map that opens into a spotlight ── */}
      <SearchSpotlight isMobile={isMobile} showDesktopSearch={showDesktopSearch} setShowDesktopSearch={setShowDesktopSearch} drawMode={drawMode}
        navSession={navSession} mapCenter={mapCenter} openDirectionsTo={openDirectionsTo} setFlyToLocation={setFlyToLocation} />


      {/* ── FLIGHT WATCH ── */}
      {watchedFlights.length > 0 && (
        <FlightWatchOverlay watchedFlights={watchedFlights} watchTelemetry={watchTelemetry} removeWatched={removeWatched}
          handleAircraftDetail={handleAircraftDetail} isMobile={isMobile} setFlyToLocation={setFlyToLocation} />
      )}

      {/* ── MAP VIEW CONTROLS — bottom-right, beside the zoom buttons ── */}
      <ViewControls revealed={revealed} isMobile={isMobile} mapProjection={mapProjection} setMapProjection={setMapProjection}
        selectFlatMap={selectFlatMap} mapStyle={mapStyle} setMapStyle={setMapStyle} mapView={mapView}
        options={!isMobile && (
          <MapOptions activeLayers={activeLayers} setActiveLayers={setActiveLayers} theme={takipTheme} setTheme={setTakipTheme}
            terrainStatus={terrainStatus} on3DModeSelected={terrainPanelProps.on3DModeSelected}
            onTerrainFocus={terrainPanelProps.onTerrainFocus} onTerrainRetry={terrainPanelProps.onTerrainRetry} />
        )} />

      {/* ── HEADER (phone; the desktop's mark sits atop the sidebar) ── */}
      {isMobile && <AppHeader revealed={revealed} isMobile />}

      {/* ── MOBILE: Compact top status ── */}
      {/* The route planner claims the top of a phone screen; leaving this in
          place would put the support badge underneath the destination field. */}
      {isMobile && !showDirections && !navSession && <MobileStatus revealed={revealed} onOpenMarkets={() => setMobilePanel('markets')} />}
      <AccountDialog />



      {/* ── SIDEBAR + THE PANEL BESIDE IT (desktop; a phone uses the bottom nav) ── */}
      {!isMobile && (
        <NavSidebar items={navItems} active={activeTool} onSelect={toggleTool} revealed={revealed}
          tiLive={oi.state?.status === 'running' || assist.busy} tiRunning={oi.state?.status === 'running'}
          footer={<>
            <MoreMenu rail onOpenMarkets={() => openTool('markets')} />
            <AccountButton rail />
          </>} />
      )}
      {!isMobile && (
        <Dock tool={activeTool}>
          {showDirections && <div className={activeTool === 'directions' ? 'min-h-0 max-h-full overflow-y-auto styled-scrollbar' : 'hidden'}>{planner}</div>}
          <AnimatePresence mode="wait" initial={false}>
            {activeTool && activeTool !== 'directions' && (
              <motion.div key={activeTool} initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.15 }}
                className={activeTool === 'layers' ? 'min-h-0 h-full' : 'min-h-0 max-h-full overflow-y-auto styled-scrollbar'}>
                {dockTool(activeTool)}
              </motion.div>
            )}
          </AnimatePresence>
        </Dock>
      )}

      {/* ── LIVE FEED VIEWER OVERLAY ── */}
      <LiveFeedModal liveFeedUrl={liveFeedUrl} liveFeedName={liveFeedName} liveFeedEmbedAllowed={liveFeedEmbedAllowed} setLiveFeedUrl={setLiveFeedUrl} />

      {/* ═══ MOBILE UI ═══ */}
      {isMobile && (
        <>
          {/* Mobile Bottom Navigation */}
          <MobileNav mobilePanel={mobilePanel} setMobilePanel={setMobilePanel} showDirections={showDirections}
            setShowDirections={setShowDirections} navSession={navSession} setActiveRoute={setActiveRoute} />

          {/* Mobile Drawer */}
          <MobileDrawer mobilePanel={mobilePanel} setMobilePanel={setMobilePanel}>
            {mobilePanel === 'layers' && (
              <>
                <MobileStats totalFlights={totalFlights} data={data} />
                <LayerPanel {...terrainPanelProps} data={data} activeLayers={activeLayers} setActiveLayers={setActiveLayers} isMobile={true} theme={takipTheme} setTheme={setTakipTheme} capabilities={capabilities} />
                <div className="mt-8">
                  <ViewPresets onNavigate={(lat, lng, zoom) => { setFlyToLocation({ lat, lng, zoom, ts: Date.now() }); setMobilePanel(null); }} />
                </div>
              </>
            )}
            {mobilePanel === 'markets' && <MarketsPanel data={data} spaceWeather={spaceWeather} />}
            {mobilePanel === 'oi' && (
              <OiPanel oi={oi} selected={oiSelected} onSelect={setOiSelected} embedded focus={oiFocus} onFocus={toggleOiFocus}
                onLocate={handleOiLocate} following={oiFollowing} onFollow={followOi}
                assist={assist} mode={oiMode} onMode={setOiMode} speakOn={oiVoice} onSpeak={setOiVoicePersist}
                stage={oiStage} onStage={setOiStage} />
            )}
            {mobilePanel === 'intel' && <IntelFeed data={data} onLocate={(lat, lng) => { setFlyToLocation({ lat, lng, ts: Date.now() }); setMobilePanel(null); }} />}
            {mobilePanel === 'search' && (
              <div className="space-y-2">
                <SearchBar embedded center={mapCenter} onDirections={openDirectionsTo} onLocate={(lat, lng, zoom) => { setFlyToLocation({ lat, lng, zoom, ts: Date.now() }); setMobilePanel(null); }} />
                <SharePanel mapView={mapView} activeLayers={activeLayers} mouseCoords={null} />
              </div>
            )}
            {mobilePanel === 'recon' && (
              <div className="space-y-2">
                <OsintPanel isMobile={true} onSweepVisualize={setSweepData} />
              </div>
            )}
          </MobileDrawer>
        </>
      )}

      {/* ── Region Dossier ── */}
      {(regionDossier || dossierLoading) && (
        <RegionDossier regionDossier={regionDossier} dossierLoading={dossierLoading}
          setRegionDossier={setRegionDossier} setDossierLoading={setDossierLoading} />
      )}

      {/* ── Camera Viewer ── */}
      <CameraViewer
        camera={activeCamera}
        onClose={() => setActiveCamera(null)}
        onLocate={(lat, lng) => setFlyToLocation({ lat, lng, ts: Date.now() })}
        besideDock={activeTool !== null && !oiTheater}
      />

      {/* ── Entity Graph Panel ── */}
      {/* Guidance belongs over the map, where the clicking happens. */}
      {drawMode && (
        <DrawHud
          mode={drawMode}
          progress={drawProgress}
          onUndo={() => sendDraw('undo')}
          onFinish={() => sendDraw('finish')}
          onCancel={() => { sendDraw('cancel'); setDrawMode(null); setDrawProgress(null); }}
        />
      )}


      {/* Keyboard Shortcuts Overlay */}
      <KeyboardShortcuts />

      {/* ── STATUS BAR (desktop): pointer readout · ticker · live numbers · links ── */}
      <div data-hud>
        <GlobalStatusBar revealed={revealed}
          left={<CursorInfo coordsDisplayRef={coordsDisplayRef} locationLabel={locationLabel} mapView={mapView} />}
          right={<LiveStats backendStatus={backendStatus} layersOn={layersOn} data={data} spaceWeather={spaceWeather} />} />
      </div>
    </main>
  );
}
