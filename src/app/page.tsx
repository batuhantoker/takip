'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type Dispatch, type SetStateAction } from 'react';
import dynamic from 'next/dynamic';
import { AnimatePresence, motion } from 'framer-motion';
import ErrorBoundary from '@/components/ui/error-boundary';
import AccountButton from '@/components/account/account-button';
import AccountDialog from '@/components/account/account-dialog';
import LiveFeedModal from '@/components/cameras/live-feed-modal';
import { useLiveFeed } from '@/components/cameras/use-live-feed';
import NavigationBanner from '@/components/directions/navigation-banner';
import RoutePlanner from '@/components/directions/route-planner';
import { useDirections } from '@/components/directions/use-directions';
import { useAreas } from '@/components/draw/use-areas';
import FlightWatchOverlay from '@/components/flights/flight-watch-overlay';
import { useFlightWatch } from '@/components/flights/use-flight-watch';
import { useArcgisLayers } from '@/components/layers/use-arcgis-layers';
import RegionDossier from '@/components/map/region-dossier';
import { useRegionDossier } from '@/components/map/use-region-dossier';
import HistoryTimelineBar from '@/components/history/history-timeline-bar';
import { historyLayers } from '@/components/history/history-layers';
import { shownSatellites } from '@/lib/satellite-filter';
import type { SatellitePoint } from '@/components/space/scene/earth';
import { useHistory } from '@/components/history/use-history';
import OiHoverCard from '@/components/oi/oi-hover-card';
import type { OiPanelProps } from '@/components/oi/oi-panel';
import { useOiAssist } from '@/components/oi/use-oi-assist';
import { useOiSession } from '@/components/oi/use-oi-session';
import { useOiShareLink } from '@/components/oi/use-oi-share-link';
import { useReconOverlays } from '@/components/recon/use-recon-overlays';
import TimelineBar from '@/components/replay/timeline-bar';
import { useReplay } from '@/components/replay/use-replay';
import { useReplaySatellites } from '@/components/replay/use-replay-satellites';
import SearchSpotlight from '@/components/search/search-spotlight';
import CursorInfo from '@/components/shell/cursor-info';
import { Dock, DOCK_WIDTH, NAV_WIDTH, type ToolId } from '@/components/shell/dock';
import DockTools from '@/components/shell/dock-tools';
import GlobalStatusBar from '@/components/shell/global-status-bar';
import KeyboardShortcuts from '@/components/shell/keyboard-shortcuts';
import MapOptions from '@/components/shell/map-options';
import MobileShell from '@/components/shell/mobile-shell';
import MoreMenu from '@/components/shell/more-menu';
import { countLayersOn, navItems } from '@/components/shell/nav-items';
import { NavSidebar } from '@/components/shell/nav-sidebar';
import SplashScreen from '@/components/shell/splash-screen';
import { splashFeeds } from '@/components/shell/splash/splash-feeds';
import { LiveStats } from '@/components/shell/status-cluster';
import ViewControls from '@/components/shell/view-controls';
import { useCursorReadout } from '@/components/shell/use-cursor-readout';
import { useIsMobile } from '@/components/shell/use-is-mobile';
import { useKeyboardShortcuts } from '@/components/shell/use-keyboard-shortcuts';
import { useLayerPersistence } from '@/components/shell/use-layer-persistence';
import { useLiveData } from '@/components/shell/use-live-data';
import { useMalwareStream } from '@/components/shell/use-malware-stream';
import { useSdkEntities } from '@/components/shell/use-sdk-entities';
import { useSplash } from '@/components/shell/use-splash';
import { useStartup } from '@/components/shell/use-startup';
import { useTheme } from '@/components/shell/use-theme';
import type { BackendStatus, FlyToTarget, LiveData, MapCenter, MapProjection, MapStyle, MobilePanel } from '@/components/shell/dashboard-types';
import SpaceSwitcherBar from '@/components/space/space-switcher-bar';
import { useSpaceMode } from '@/components/space/use-space-mode';
import { warmSpace } from '@/components/space/warm-space';
import { DEFAULT_LAYERS } from '@/lib/default-layers';
import type { TerrainStatus } from '@/lib/map-terrain';
import { newsTransform } from '@/lib/news-transform';

const WorldMap = dynamic(() => import('@/components/map/world-map'), { ssr: false });
const SpaceShell = dynamic(() => import('@/components/space/space-shell'), { ssr: false });
const CameraViewer = dynamic(() => import('@/components/cameras/camera-viewer'));
const DrawHud = dynamic(() => import('@/components/draw/draw-hud'), { ssr: false });

const SATELLITE_TILES = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';

export default function Dashboard() {
  const dataRef = useRef<LiveData>({});
  const [dataVersion, setDataVersion] = useState(0);
  const data = dataRef.current;
  const [backendStatus, setBackendStatus] = useState<BackendStatus>('connecting');
  const [spaceWeather, setSpaceWeather] = useState<any>(null);

  const [mapReady, setMapReady] = useState(false);
  const [mapView, setMapView] = useState({ zoom: 2.5, latitude: 20 });
  const [mapCenter, setMapCenter] = useState<MapCenter | null>(null);
  const [mapProjection, setMapProjection] = useState<MapProjection>('globe');
  const [mapStyle, setMapStyle] = useState<MapStyle>('dark');
  const [flyToLocation, setFlyToLocation] = useState<FlyToTarget | null>(null);
  const [terrainFocus, setTerrainFocus] = useState(0);
  const [terrainStatus, setTerrainStatus] = useState<TerrainStatus>('idle');
  const [terrainRetry, setTerrainRetry] = useState(0);
  /* The Live Alerts the feed's filters leave showing; the map pins those. */
  const [pinnedAlertIds, setPinnedAlertIds] = useState<string[] | null>(null);
  const [activeCamera, setActiveCamera] = useState<any>(null);
  const [activeLayers, setActiveLayers] = useState(DEFAULT_LAYERS);
  const [theme, setTheme] = useTheme();
  const isMobile = useIsMobile();

  /* Map or space: the space view opens over the map's own centre. */
  const space = useSpaceMode(() => (mapCenter ? { lat: mapCenter.lat, lng: mapCenter.lng, zoom: mapView.zoom } : undefined));
  const replay = useReplay();
  const history = useHistory();
  const { open: openHistory, close: closeHistory } = history;
  const { toggle: toggleReplaySession } = replay;
  const replayOn = !!replay.session;
  // Replay and History each take over the bottom bar, so starting one ends the other.
  const toggleReplay = useCallback(() => { closeHistory(); toggleReplaySession(); }, [closeHistory, toggleReplaySession]);
  const startHistory = useCallback(() => { if (replayOn) toggleReplaySession(); openHistory(); }, [replayOn, toggleReplaySession, openHistory]);
  // Anything that moves the map — search, an alert, a dossier — brings the map back.
  const exitSpace = space.exit;
  // Not the start-up fly-in: it can land late, after the operator has already zoomed out into space.
  useEffect(() => { if (flyToLocation && !flyToLocation.quiet) exitSpace(); }, [flyToLocation, exitSpace]);
  // Zooming back down into Earth lands the map on the spot under the camera.
  const leaveSpace = useCallback((to?: { lat: number; lng: number; zoom: number }) => {
    if (to) setFlyToLocation({ ...to, duration: 0, ts: Date.now() });
    else exitSpace();
  }, [exitSpace]);

  /** The panel open beside the sidebar, if any. */
  const [activeTool, setActiveTool] = useState<ToolId | null>(null);
  /** Layers is a sidebar panel; TI and the L key still switch it like the old rail. */
  const setShowLayers: Dispatch<SetStateAction<boolean>> = useCallback(v => setActiveTool(cur => {
    const on = typeof v === 'function' ? v(cur === 'layers') : v;
    return on ? 'layers' : cur === 'layers' ? null : cur;
  }), []);
  const [mobilePanel, setMobilePanel] = useState<MobilePanel | null>(null);
  const [showDesktopSearch, setShowDesktopSearch] = useState(false);

  const splash = useSplash(mapReady);
  const { capabilities, autoLocateCancelled } = useStartup({ setActiveLayers, setFlyToLocation, splashGone: splash.splashGone });
  const cursor = useCursorReadout();
  const dossier = useRegionDossier();
  const areas = useAreas(dataRef, dataVersion);
  const directions = useDirections();
  const arcgis = useArcgisLayers();
  const recon = useReconOverlays();
  const { openFeed, ...feed } = useLiveFeed();
  const { watchedFlights, aircraftAirports, removeWatched, handleAircraftDetail, watchTelemetry } = useFlightWatch(data);

  const session = useOiSession({ mobilePanel, setMobilePanel, setActiveTool, setFlyToLocation });
  const { oi, oiTheater, setOiTheater, oiStage, setOiStage, setOiMode, setOiAutoFocus } = session;
  useOiShareLink({ oi, setOiMode, setMobilePanel, setActiveTool, autoLocateCancelled });
  const { oiHighlight, oiVoice, setOiVoicePersist, assist } = useOiAssist({
    dataRef, oi, oiGlobe: session.oiGlobe, activeLayers, setActiveLayers, mapCenter, mapView, mapProjection, setMapProjection, mapStyle, setMapStyle,
    oiTheater, setOiTheater, oiStage, setOiStage, setOiMode, setOiSelected: session.setOiSelected,
    setMobilePanel, setActiveTool, setShowLayers, setShowDirections: directions.setShowDirections, setFlyToLocation, setActiveCamera,
  });
  const { oiFocus, toggleOiFocus } = useLayerPersistence({ activeLayers, setActiveLayers });

  // History draws only the past: the map and the live pollers see every data layer off until LIVE.
  const mapLayers = useMemo(() => (history.session ? historyLayers(activeLayers) : activeLayers), [history.session, activeLayers]);
  // Space shows the satellites the map's layers would: none while they are off, or while History has them off.
  const spaceSatellites = useMemo(() => shownSatellites<SatellitePoint>(data.satellites, mapLayers), [data.satellites, mapLayers]);
  const { fetchEndpoint } = useLiveData({ dataRef, setDataVersion, setBackendStatus, setSpaceWeather, activeLayers: mapLayers, replayActive: !!replay.session });
  useReplaySatellites({ replay: replay.session, activeLayers, fetchEndpoint });
  useMalwareStream({ dataRef, setDataVersion, setBackendStatus, activeLayers });
  useSdkEntities({ dataRef, data, dataVersion, activeLayers });
  useKeyboardShortcuts({
    setShowDesktopSearch, setActiveTool, setOiMode, setOiAutoFocus, setMobilePanel, setShowLayers, setFlyToLocation, setActiveLayers, setMapProjection,
  });

  const flyTo = useCallback((lat: number, lng: number, zoom?: number) => setFlyToLocation({ lat, lng, zoom, ts: Date.now() }), []);
  const selectFlatMap = () => {
    setActiveLayers(prev => ({ ...prev, terrain_elevation: false, terrain_3d: false }));
    setMapProjection('mercator');
  };
  const terrain = {
    terrainStatus,
    on3DModeSelected: () => setMapProjection('globe'),
    onTerrainRetry: () => setTerrainRetry(value => value + 1),
    onTerrainFocus: () => setTerrainFocus(value => value + 1),
  };

  const handleEntityClick = useCallback((entity: any) => {
    if (entity?.type === 'cctv') setActiveCamera(entity);
    if (entity?.type === 'live_news' && entity.url) openFeed(entity.url, entity.name, entity.embed_allowed !== false);
  }, [openFeed]);

  /** From Search: open Directions with this place as the destination, and show where it is. */
  const { setRouteTarget, setActiveRoute, setShowDirections } = directions;
  const openDirectionsTo = useCallback((p: { label: string; context?: string; lat: number; lng: number; kind?: string }) => {
    setRouteTarget({ ...p, ts: Date.now() });
    setActiveRoute(null);
    setShowDesktopSearch(false);
    setMobilePanel(null);
    setShowDirections(true);
    setActiveTool('directions');
    setFlyToLocation({ lat: p.lat, lng: p.lng, zoom: 14, ts: Date.now() });
  }, [setRouteTarget, setActiveRoute, setShowDirections]);

  const closeOi = () => { setActiveTool(null); setOiTheater(false); setOiAutoFocus(false); };
  /** A sidebar entry: opens its panel, or closes the one already showing. */
  const toggleTool = (tool: ToolId) => {
    if (activeTool === tool) {
      if (tool === 'directions') directions.closeDirections();
      if (tool === 'oi') closeOi();
      setActiveTool(null);
      return;
    }
    if (oiTheater) setOiTheater(false);
    if (tool === 'directions' && !directions.showDirections) { setRouteTarget(null); setShowDirections(true); setShowDesktopSearch(false); }
    if (tool === 'history') startHistory();
    setActiveTool(tool);
  };
  const exitHistory = () => { closeHistory(); setActiveTool(t => (t === 'history' ? null : t)); };
  const openTool = (tool: ToolId) => { if (activeTool !== tool) toggleTool(tool); };

  const layersOn = useMemo(() => countLayersOn(activeLayers), [activeLayers]);
  /** Where the map's own controls start: right of the sidebar and of any panel open beside it. */
  const shellLeft = isMobile ? 0 : NAV_WIDTH + (activeTool && !oiTheater ? DOCK_WIDTH + 16 : 0);

  const ti: OiPanelProps = {
    oi, selected: session.oiSelected, onSelect: session.setOiSelected, focus: oiFocus, onFocus: toggleOiFocus,
    onLocate: session.handleOiLocate, following: session.oiFollowing, onFollow: session.followOi,
    assist, mode: session.oiMode, onMode: setOiMode, speakOn: oiVoice, onSpeak: setOiVoicePersist, stage: oiStage, onStage: setOiStage,
  };
  const planner = directions.showDirections && (
    <RoutePlanner directions={directions} center={mapCenter ? { lat: mapCenter.lat, lng: mapCenter.lng } : null} onLocate={flyTo}
      onClose={() => { directions.closeDirections(); setActiveTool(t => (t === 'directions' ? null : t)); }} />
  );

  return (
    <main className="fixed inset-0 w-full h-full bg-[var(--bg-void)] overflow-hidden" style={{ '--shell-left': `${shellLeft}px` } as CSSProperties}>
      <SplashScreen showSplash={splash.showSplash} splashStage={splash.splashStage} setSplashGone={splash.setSplashGone}
        feeds={splash.showSplash ? splashFeeds(data) : undefined} />

      <ErrorBoundary name="Map">
        <WorldMap
          key={theme}
          data={data}
          activeLayers={mapLayers}
          projection={mapProjection === 'mercator' ? 'mercator' : 'globe'}
          terrainEnabled={activeLayers.terrain_elevation && mapProjection === 'globe'}
          terrainFocus={terrainFocus}
          terrainRetry={terrainRetry}
          onTerrainStatusChange={setTerrainStatus}
          mapStyle={mapStyle === 'satellite' ? SATELLITE_TILES : mapStyle === 'topo' ? 'topo' : 'dark'}
          onEntityClick={handleEntityClick}
          onMouseCoords={cursor.handleMouseCoords}
          onRightClick={dossier.openDossier}
          onViewStateChange={setMapView}
          onReady={() => setMapReady(true)}
          replay={replay.session}
          onReplayToggle={toggleReplay}
          history={history.session}
          historyFamilies={history.families}
          flyToLocation={flyToLocation}
          alertPinIds={pinnedAlertIds}
          sweepData={recon.sweepData}
          scanTargets={recon.scanTargets}
          theme={theme}
          arcgisLayers={arcgis.onMap}
          onMapCenter={setMapCenter}
          // History's globe is another age; space is today's.
          onZoomPastGlobe={history.session ? undefined : space.zoomOut}
          onNearGlobe={warmSpace}
          route={directions.activeRoute}
          userLocation={directions.userLocation}
          followUser={directions.followUser}
          onFollowInterrupt={() => directions.setFollowUser(false)}
          navigating={Boolean(directions.navSession)}
          drawMode={areas.drawMode}
          onDrawProgress={areas.setDrawProgress}
          drawCommand={areas.drawCommand}
          onDrawCancel={areas.stopDrawing}
          onDrawComplete={areas.handleDrawComplete}
          drawnPolygons={areas.drawnPolygons}
          aircraftAirports={aircraftAirports}
          onOiGlobe={session.handleOiGlobe}
          onOiSelect={session.handleOiSelect}
          onOiHover={session.setOiHover}
          onOiFollow={session.setOiFollowing}
          oiHighlight={oiHighlight}
        />
      </ErrorBoundary>

      {/* The Sun, planets and spacecraft at their real positions, over the map. */}
      <AnimatePresence>
        {space.inSpace && (
          <ErrorBoundary key="space" name="Space">
            <SpaceShell request={space.request} satellites={spaceSatellites} onFocus={space.setFocus} onExit={leaveSpace} />
          </ErrorBoundary>
        )}
      </AnimatePresence>

      {session.oiHover && !isMobile && <OiHoverCard oiHover={session.oiHover} />}

      {/* Guidance is a banner at the top; on a phone the planner opens in it too. */}
      <NavigationBanner navSession={directions.navSession} setNavSession={directions.setNavSession} liveLocation={directions.liveLocation}
        setNavProgress={directions.setNavProgress} followUser={directions.followUser} setFollowUser={directions.setFollowUser} setActiveRoute={setActiveRoute}>
        {isMobile && planner}
      </NavigationBanner>

      <SearchSpotlight isMobile={isMobile} showDesktopSearch={showDesktopSearch} setShowDesktopSearch={setShowDesktopSearch} drawMode={areas.drawMode}
        navSession={directions.navSession} mapCenter={mapCenter} openDirectionsTo={openDirectionsTo} setFlyToLocation={setFlyToLocation} />

      {watchedFlights.length > 0 && (
        <FlightWatchOverlay watchedFlights={watchedFlights} watchTelemetry={watchTelemetry} removeWatched={removeWatched}
          handleAircraftDetail={handleAircraftDetail} isMobile={isMobile} setFlyToLocation={setFlyToLocation} />
      )}

      {!space.inSpace && (
        <ViewControls revealed={splash.revealed} isMobile={isMobile} mapProjection={mapProjection} setMapProjection={setMapProjection}
          selectFlatMap={selectFlatMap} mapStyle={mapStyle} setMapStyle={setMapStyle} mapView={mapView} compact={shellLeft > NAV_WIDTH}
          options={!isMobile && (
            <MapOptions activeLayers={activeLayers} setActiveLayers={setActiveLayers} theme={theme} setTheme={setTheme} terrainStatus={terrainStatus}
              on3DModeSelected={terrain.on3DModeSelected} onTerrainFocus={terrain.onTerrainFocus} onTerrainRetry={terrain.onTerrainRetry} compact={shellLeft > NAV_WIDTH} />
          )} />
      )}
      <SpaceSwitcherBar revealed={splash.revealed} isMobile={isMobile} inSpace={space.inSpace} focus={space.focus} onMap={space.exit} onSpace={space.enter} />

      {isMobile ? (
        <MobileShell revealed={splash.revealed} mobilePanel={mobilePanel} setMobilePanel={setMobilePanel} directions={directions}
          data={data} activeLayers={activeLayers} setActiveLayers={setActiveLayers} capabilities={capabilities} terrain={terrain}
          theme={theme} setTheme={setTheme} ti={ti} spaceWeather={spaceWeather} mapCenter={mapCenter} mapView={mapView}
          openDirectionsTo={openDirectionsTo} setFlyToLocation={setFlyToLocation} onSweep={recon.setSweepData} />
      ) : (
        <>
          <NavSidebar items={navItems({ layersOn, arcgisCount: arcgis.arcgisLayers.length })} active={activeTool} onSelect={toggleTool}
            revealed={splash.revealed} tiLive={oi.state?.status === 'running' || assist.busy} tiRunning={oi.state?.status === 'running'}
            footer={<>
              <MoreMenu rail onOpenMarkets={() => openTool('markets')} />
              <AccountButton rail />
            </>} />
          <Dock tool={activeTool}>
            {planner && <div className={activeTool === 'directions' ? 'min-h-0 max-h-full overflow-y-auto styled-scrollbar' : 'hidden'}>{planner}</div>}
            <AnimatePresence mode="wait" initial={false}>
              {activeTool && activeTool !== 'directions' && (
                <motion.div key={activeTool} initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.15 }}
                  className={activeTool === 'layers' ? 'min-h-0 h-full' : 'min-h-0 max-h-full overflow-y-auto styled-scrollbar'}>
                  <DockTools tool={activeTool} onClose={() => setActiveTool(null)} data={data} activeLayers={activeLayers} setActiveLayers={setActiveLayers}
                    capabilities={capabilities} layersOn={layersOn} areas={areas} arcgis={arcgis} mapBounds={mapCenter?.bounds ?? null}
                    ti={{ ...ti, onClose: closeOi, theater: oiTheater, onTheater: setOiTheater, autoFocus: session.oiAutoFocus }}
                    setFlyToLocation={setFlyToLocation} setPinnedAlertIds={setPinnedAlertIds} openFeed={openFeed}
                    refreshNews={() => fetchEndpoint('/api/news', newsTransform)} onSweep={recon.setSweepData}
                    onScanGeolocate={recon.addScanTarget} spaceWeather={spaceWeather} history={{ session: history.session, open: startHistory }} />
                </motion.div>
              )}
            </AnimatePresence>
          </Dock>
          {/* Pointer readout · ticker · live numbers · links; the replay or history timeline takes its place */}
          {replay.session ? <TimelineBar session={replay.session} onExit={replay.toggle} /> : history.session ? <HistoryTimelineBar session={history.session} onExit={exitHistory} /> : (
            <div data-hud>
              <GlobalStatusBar revealed={splash.revealed}
                left={<CursorInfo coordsDisplayRef={cursor.coordsDisplayRef} locationLabel={cursor.locationLabel} mapView={mapView} />}
                right={<LiveStats backendStatus={backendStatus} layersOn={layersOn} data={data} spaceWeather={spaceWeather} />} />
            </div>
          )}
        </>
      )}

      <AccountDialog />
      <LiveFeedModal liveFeedUrl={feed.liveFeedUrl} liveFeedName={feed.liveFeedName} liveFeedEmbedAllowed={feed.liveFeedEmbedAllowed} setLiveFeedUrl={feed.setLiveFeedUrl} />

      {(dossier.regionDossier || dossier.dossierLoading) && (
        <RegionDossier regionDossier={dossier.regionDossier} dossierLoading={dossier.dossierLoading}
          setRegionDossier={dossier.setRegionDossier} setDossierLoading={dossier.setDossierLoading} />
      )}

      <CameraViewer camera={activeCamera} onClose={() => setActiveCamera(null)} onLocate={(lat, lng) => flyTo(lat, lng)} />

      {/* Guidance belongs over the map, where the clicking happens. */}
      {areas.drawMode && (
        <DrawHud mode={areas.drawMode} progress={areas.drawProgress}
          onUndo={() => areas.sendDraw('undo')} onFinish={() => areas.sendDraw('finish')}
          onCancel={() => { areas.sendDraw('cancel'); areas.stopDrawing(); }} />
      )}

      <KeyboardShortcuts />
    </main>
  );
}
