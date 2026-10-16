'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type Dispatch, type SetStateAction } from 'react';
import dynamic from 'next/dynamic';
import { AnimatePresence } from 'framer-motion';
import ErrorBoundary from '@/components/ui/error-boundary';
import AccountButton from '@/components/site/account/account-button';
import AccountDialog from '@/components/site/account/account-dialog';
import MapTimeWall from '@/components/site/account/map-time/map-time-wall';
import ReportDialog from '@/components/site/report/report-dialog';
import { trackKey, trackedNow } from '@/components/map/inspect/track-request';
import { reportMode, type ViewInputs } from '@/lib/platform/reports/report-view';
import LiveFeedModal from '@/components/map/cameras/live-feed-modal';
import { useLiveFeed } from '@/components/map/cameras/use-live-feed';
import NavigationBanner from '@/components/panels/route/navigation-banner';
import RoutePlanner from '@/components/panels/route/route-panel';
import { useDirections } from '@/components/panels/route/use-directions';
import { useAreas } from '@/components/panels/areas/use-areas';
import { useArcgisLayers } from '@/components/panels/arcgis/use-arcgis-layers';
import RegionDossier from '@/components/map/dossier/region-dossier';
import { useRegionDossier } from '@/components/map/dossier/use-region-dossier';
import HistoryTimelineBar from '@/components/panels/history/history-timeline-bar';
import { historyLayers } from '@/components/panels/history/history-layers';
import { replayLayers } from '@/components/map/replay/replay-layers';
import { useBackToLive } from '@/components/shell/state/use-back-to-live';
import { shownSatellites } from '@/lib/feeds/satellites/filter';
import type { SatellitePoint } from '@/lib/space/scene/earth';
import { useHistory } from '@/components/panels/history/use-history';
import AiHoverCard from '@/components/panels/ti-agent/ti-hover-card';
import type { AiPanelProps } from '@/components/panels/ti-agent/ti-panel';
import { useAiAssist } from '@/components/panels/ti-agent/use-ti-assist';
import { useAiSession } from '@/components/panels/ti-agent/use-ti-session';
import { useAiShareLink } from '@/components/panels/ti-agent/use-ti-share-link';
import { useReconOverlays } from '@/components/panels/recon/use-recon-overlays';
import TimelineBar from '@/components/map/replay/timeline-bar';
import { useReplay } from '@/components/map/replay/use-replay';
import { useReplaySatellites } from '@/components/map/replay/use-replay-satellites';
import SearchSpotlight from '@/components/shell/search/search-spotlight';
import CursorInfo from '@/components/shell/status-bar/cursor-info';
import { Dock, DockSlot, DOCK_WIDTH, NAV_WIDTH, type ToolId } from '@/components/shell/sidebar/dock';
import DockTools from '@/components/shell/sidebar/dock-tools';
import GlobalStatusBar from '@/components/shell/status-bar/global-status-bar';
import KeyboardShortcuts from '@/components/shell/keyboard/keyboard-shortcuts';
import MapCluster from '@/components/map/controls/map-cluster';
import MapOptions from '@/components/shell/map-look/map-options';
import MobileShell from '@/components/shell/mobile/mobile-shell';
import MoreMenu from '@/components/shell/more/more-menu';
import { countLayersOn, navItems } from '@/components/shell/sidebar/nav-items';
import { NavSidebar } from '@/components/shell/sidebar/nav-sidebar';
import SplashScreen from '@/components/shell/splash/splash-screen';
import { LiveStats } from '@/components/shell/status-bar/status-cluster';
import { useCursorReadout } from '@/components/shell/status-bar/use-cursor-readout';
import { useIsMobile } from '@/components/ui/use-is-mobile';
import { useKeyboardShortcuts } from '@/components/shell/keyboard/use-keyboard-shortcuts';
import { useLayerGate } from '@/components/shell/state/use-layer-gate';
import { useLayerPersistence } from '@/components/shell/state/use-layer-persistence';
import { useLiveData } from '@/components/shell/state/use-live-data';
import { useNearbyFlights } from '@/components/shell/state/use-nearby-flights';
import { useMalwareStream } from '@/components/shell/state/use-malware-stream';
import { useSdkEntities } from '@/components/shell/state/use-sdk-entities';
import { useSplash } from '@/components/shell/splash/use-splash';
import { useStartup } from '@/components/shell/state/use-startup';
import { useTheme } from '@/components/shell/map-look/use-theme';
import type { BackendStatus, FlyToTarget, LiveData, MapCenter, MapProjection, MapStyle, MobilePanel } from '@/components/shell/state/types';
import SpaceSwitcherBar from '@/components/panels/space/view/space-switcher-bar';
import ShowingChip from '@/components/shell/showing/showing-chip';
import { useSpaceMode } from '@/components/panels/space/view/use-space-mode';
import { warmSpace } from '@/components/panels/space/view/warm-space';
import type { GlobeLink } from '@/lib/space/globe-match';
import { DEFAULT_LAYERS } from '@/lib/map/layers/defaults';
import type { TerrainStatus } from '@/lib/map/terrain/terrain';
import { newsTransform } from '@/lib/intel/alerts/news-transform';

const WorldMap = dynamic(() => import('@/components/map/world-map'), { ssr: false });
const SpaceShell = dynamic(() => import('@/components/panels/space/view/space-shell'), { ssr: false });
const CameraWindows = dynamic(() => import('@/components/map/cameras/camera-windows'));
const DrawHud = dynamic(() => import('@/components/panels/areas/parts/draw-hud'), { ssr: false });

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
  /* The live map, for the space view to meet on its way back down. */
  const [globeLink, setGlobeLink] = useState<GlobeLink | null>(null);
  const [terrainFocus, setTerrainFocus] = useState(0);
  const [terrainStatus, setTerrainStatus] = useState<TerrainStatus>('idle');
  const [terrainRetry, setTerrainRetry] = useState(0);
  /* The Live Alerts the feed's filters leave showing; the map pins those. */
  const [pinnedAlertIds, setPinnedAlertIds] = useState<string[] | null>(null);
  const [activeCamera, setActiveCamera] = useState<any>(null);
  const [chosenLayers, setChosenLayers] = useState(DEFAULT_LAYERS);
  const { activeLayers, setActiveLayers } = useLayerGate(chosenLayers, setChosenLayers);
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
  const { showCentre } = cursor;
  useEffect(() => { if (mapCenter) showCentre(mapCenter); }, [mapCenter, showCentre]);
  const dossier = useRegionDossier();
  const areas = useAreas(dataRef, dataVersion);
  const directions = useDirections();
  const arcgis = useArcgisLayers();
  const recon = useReconOverlays();
  const { openFeed, ...feed } = useLiveFeed();

  const session = useAiSession({ mobilePanel, setMobilePanel, setActiveTool, setFlyToLocation });
  const { ai, aiTheater, setAiTheater, aiStage, setAiStage, setAiMode, setAiAutoFocus } = session;
  useAiShareLink({ ai, setAiMode, setMobilePanel, setActiveTool, autoLocateCancelled });
  const { aiHighlight, aiVoice, setAiVoicePersist, assist } = useAiAssist({
    dataRef, ai, aiGlobe: session.aiGlobe, activeLayers, setActiveLayers, mapCenter, mapView, mapProjection, setMapProjection, mapStyle, setMapStyle,
    aiTheater, setAiTheater, aiStage, setAiStage, setAiMode, setAiSelected: session.setAiSelected,
    setMobilePanel, setActiveTool, setShowLayers, setShowDirections: directions.setShowDirections, setFlyToLocation, setActiveCamera,
    replay, history,
  });
  // What was chosen, not what the plan lets through: signing up brings closed layers back.
  const { aiFocus, toggleAiFocus } = useLayerPersistence({ activeLayers: chosenLayers, setActiveLayers });

  // History draws only the past and Replay only what it recorded: the map and the live pollers see the rest off until LIVE.
  const mapLayers = useMemo(
    () => (history.session ? historyLayers(activeLayers) : replay.session ? replayLayers(activeLayers) : activeLayers),
    [history.session, replay.session, activeLayers],
  );
  // Space shows the satellites the map's layers would: none while they are off, or while History has them off.
  const spaceSatellites = useMemo(() => shownSatellites<SatellitePoint>(data.satellites, mapLayers), [data.satellites, mapLayers]);
  const { fetchEndpoint } = useLiveData({ dataRef, setDataVersion, setBackendStatus, setSpaceWeather, activeLayers: mapLayers, replayActive: !!replay.session });
  useNearbyFlights({ dataRef, dataVersion, setDataVersion, mapCenter, zoom: mapView.zoom, activeLayers: mapLayers, replayActive: !!replay.session });
  useReplaySatellites({ replay: replay.session, activeLayers, fetchEndpoint });
  useMalwareStream({ dataRef, setDataVersion, setBackendStatus, activeLayers });
  useSdkEntities({ dataRef, data, dataVersion, activeLayers });

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

  // One sheet at a time on a phone: inspecting something closes the panel, and a panel hides the camera player.
  const closeMobileSheet = useCallback(() => setMobilePanel(null), []);

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

  const closeAi = () => { setActiveTool(null); setAiTheater(false); setAiAutoFocus(false); };
  /** A sidebar entry: opens its panel, or closes the one already showing. */
  const toggleTool = (tool: ToolId) => {
    if (activeTool === tool) {
      if (tool === 'directions') directions.closeDirections();
      if (tool === 'ai') closeAi();
      setActiveTool(null);
      return;
    }
    if (aiTheater) setAiTheater(false);
    if (tool === 'directions' && !directions.showDirections) { setRouteTarget(null); setShowDirections(true); setShowDesktopSearch(false); }
    if (tool === 'history') startHistory();
    setActiveTool(tool);
  };
  const closeTool = () => { if (activeTool) toggleTool(activeTool); };
  const exitHistory = () => { closeHistory(); setActiveTool(t => (t === 'history' ? null : t)); };
  const openTool = (tool: ToolId) => { if (activeTool !== tool) toggleTool(tool); };
  useKeyboardShortcuts({
    setShowDesktopSearch, onTool: toggleTool, onReplay: toggleReplay, setAiMode, setAiAutoFocus, setMobilePanel, setActiveTool, setFlyToLocation, setActiveLayers, setMapProjection,
  });
  useBackToLive({ activeLayers, past: history.session ? 'history' : replayOn ? 'replay' : null, exitPast: history.session ? exitHistory : toggleReplaySession });

  const layersOn = useMemo(() => countLayersOn(activeLayers), [activeLayers]);
  /** Where the map's own controls start: right of the sidebar and of any panel open beside it. */
  const shellLeft = isMobile ? 0 : NAV_WIDTH + (activeTool && !aiTheater ? DOCK_WIDTH : 0);

  const ti: AiPanelProps = {
    ai, selected: session.aiSelected, onSelect: session.setAiSelected, focus: aiFocus, onFocus: toggleAiFocus,
    onLocate: session.handleAiLocate, following: session.aiFollowing, onFollow: session.followAi,
    assist, mode: session.aiMode, onMode: setAiMode, speakOn: aiVoice, onSpeak: setAiVoicePersist, stage: aiStage, onStage: setAiStage,
  };
  /** What a report attaches about the map; report-dialog.tsx asks on Send. */
  const reportView = (): ViewInputs => {
    const followed = trackedNow();
    return {
      center: mapCenter, zoom: mapView.zoom, layers: activeLayers, mode: reportMode(replay.session, history.session),
      space: space.inSpace ? space.focus : null, track: followed && trackKey(followed),
      baseMap: mapStyle, projection: mapProjection, theme, panel: isMobile ? mobilePanel : activeTool,
    };
  };
  const planner = directions.showDirections && (
    <RoutePlanner directions={directions} center={mapCenter ? { lat: mapCenter.lat, lng: mapCenter.lng } : null} onLocate={flyTo}
      onClose={() => { directions.closeDirections(); setActiveTool(t => (t === 'directions' ? null : t)); }} />
  );

  const showing = !space.inSpace && (
    <ShowingChip isMobile={isMobile} revealed={splash.revealed} layers={mapLayers} chosen={activeLayers} setLayers={setActiveLayers} history={history.session} families={history.families}
      replay={replay.session} arcgis={arcgis} areas={areas.drawnPolygons} onOpen={p => (isMobile ? setMobilePanel('layers') : openTool(p))} />
  );

  return (
    <main className="fixed inset-0 h-full w-full overflow-hidden bg-surface-0" data-in-space={space.inSpace || undefined}
      style={{ '--shell-left': `${shellLeft}px` } as CSSProperties}>
      <SplashScreen showSplash={splash.showSplash} splashStage={splash.splashStage} setSplashGone={splash.setSplashGone} />

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
          onGlobeLink={setGlobeLink}
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
          imageryRequest={areas.imageryRequest}
          onAiGlobe={session.handleAiGlobe}
          onAiSelect={session.handleAiSelect}
          onAiHover={session.setAiHover}
          onAiFollow={session.setAiFollowing}
          aiHighlight={aiHighlight}
          mobileSheetOpen={isMobile && !!mobilePanel}
          onInspectOpen={closeMobileSheet}
        />
      </ErrorBoundary>

      {/* The Sun, planets and spacecraft at their real positions, over the map. */}
      <AnimatePresence>
        {space.inSpace && (
          <ErrorBoundary key="space" name="Space">
            <SpaceShell request={space.request} satellites={spaceSatellites} map={mapProjection === 'mercator' ? null : globeLink} onFocus={space.setFocus} onExit={leaveSpace} />
          </ErrorBoundary>
        )}
      </AnimatePresence>

      {session.aiHover && !isMobile && <AiHoverCard aiHover={session.aiHover} />}

      {/* Guidance is a banner at the top; on a phone the planner opens in it too. */}
      <NavigationBanner navSession={directions.navSession} setNavSession={directions.setNavSession} liveLocation={directions.liveLocation}
        setNavProgress={directions.setNavProgress} followUser={directions.followUser} setFollowUser={directions.setFollowUser} setActiveRoute={setActiveRoute}>
        {isMobile && planner}
      </NavigationBanner>

      <SearchSpotlight isMobile={isMobile} showDesktopSearch={showDesktopSearch} setShowDesktopSearch={setShowDesktopSearch} drawMode={areas.drawMode}
        navSession={directions.navSession} mapCenter={mapCenter} openDirectionsTo={openDirectionsTo} setFlyToLocation={setFlyToLocation} />

      {!space.inSpace && (
        <MapCluster revealed={splash.revealed} isMobile={isMobile} mapProjection={mapProjection} setMapProjection={setMapProjection}
          selectFlatMap={selectFlatMap} mapStyle={mapStyle} setMapStyle={setMapStyle} mapView={mapView} replayOn={replayOn} onReplay={mapReady ? toggleReplay : undefined}
          options={isMobile ? undefined : openStudio => (
            <MapOptions activeLayers={activeLayers} setActiveLayers={setActiveLayers} theme={theme} setTheme={setTheme} terrainStatus={terrainStatus}
              on3DModeSelected={terrain.on3DModeSelected} onTerrainFocus={terrain.onTerrainFocus} onTerrainRetry={terrain.onTerrainRetry} onOpenStudio={openStudio} />
          )} />
      )}
      <SpaceSwitcherBar revealed={splash.revealed} isMobile={isMobile} inSpace={space.inSpace} focus={space.focus} onMap={space.exit} onSpace={space.enter}
        beside={isMobile && showing} />
      {!isMobile && showing}

      {isMobile ? (
        <MobileShell revealed={splash.revealed} mobilePanel={mobilePanel} setMobilePanel={setMobilePanel} directions={directions}
          data={data} activeLayers={activeLayers} setActiveLayers={setActiveLayers} capabilities={capabilities} terrain={terrain}
          theme={theme} setTheme={setTheme} ti={ti} spaceWeather={spaceWeather} mapCenter={mapCenter} mapView={mapView}
          openDirectionsTo={openDirectionsTo} setFlyToLocation={setFlyToLocation} onSweep={recon.setSweepData} />
      ) : (
        <>
          <NavSidebar groups={navItems({ layersOn, arcgisCount: arcgis.arcgisLayers.length, historyOn: !!history.session })} active={activeTool} onSelect={toggleTool}
            revealed={splash.revealed} tiLive={ai.state?.status === 'running' || assist.busy} tiRunning={ai.state?.status === 'running'}
            footer={<>
              <MoreMenu rail active={activeTool === 'markets'} onOpenMarkets={() => openTool('markets')} />
              <AccountButton rail />
            </>} />
          <Dock tool={activeTool} onClose={closeTool}>
            {planner && <DockSlot hidden={activeTool !== 'directions'}>{planner}</DockSlot>}
            {activeTool && activeTool !== 'directions' && (
              <DockSlot key={activeTool}>
                <DockTools tool={activeTool} onClose={() => setActiveTool(null)} data={data} activeLayers={activeLayers} setActiveLayers={setActiveLayers}
                  capabilities={capabilities} areas={areas} arcgis={arcgis} mapBounds={mapCenter?.bounds ?? null}
                  ti={{ ...ti, onClose: closeAi, theater: aiTheater, onTheater: setAiTheater, autoFocus: session.aiAutoFocus }}
                  setFlyToLocation={setFlyToLocation} setPinnedAlertIds={setPinnedAlertIds} openFeed={openFeed}
                  refreshNews={() => fetchEndpoint('/api/news', newsTransform)} onSweep={recon.setSweepData}
                  onScanGeolocate={recon.addScanTarget} spaceWeather={spaceWeather} history={{ session: history.session, open: startHistory, exit: exitHistory }} />
              </DockSlot>
            )}
          </Dock>
          {/* Where the pointer is, and the live state; the replay or history timeline takes its place. */}
          {replay.session ? <TimelineBar session={replay.session} onExit={replay.toggle} /> : history.session ? <HistoryTimelineBar session={history.session} onExit={exitHistory} /> : (
            <GlobalStatusBar revealed={splash.revealed}
              left={<CursorInfo coordsDisplayRef={cursor.coordsDisplayRef} locationLabel={cursor.locationLabel} hidden={space.inSpace} />}
              right={<LiveStats backendStatus={backendStatus} data={data} onLocate={(lat, lng) => flyTo(lat, lng, 6)} />} />
          )}
        </>
      )}

      <MapTimeWall />
      <AccountDialog map={{ mapStyle, setMapStyle, activeLayers, setActiveLayers, ...terrain }} />
      <ReportDialog view={reportView} />
      <LiveFeedModal liveFeedUrl={feed.liveFeedUrl} liveFeedName={feed.liveFeedName} liveFeedEmbedAllowed={feed.liveFeedEmbedAllowed} setLiveFeedUrl={feed.setLiveFeedUrl} />

      {(dossier.regionDossier || dossier.dossierLoading) && (
        <RegionDossier regionDossier={dossier.regionDossier} dossierLoading={dossier.dossierLoading}
          setRegionDossier={dossier.setRegionDossier} setDossierLoading={dossier.setDossierLoading} />
      )}

      <CameraWindows camera={isMobile && mobilePanel ? null : activeCamera} onClose={() => setActiveCamera(null)} onLocate={(lat, lng) => flyTo(lat, lng)} />

      {/* Guidance belongs over the map, where the clicking happens. */}
      {areas.drawMode && (
        <DrawHud mode={areas.drawMode} progress={areas.drawProgress} left={shellLeft}
          onUndo={() => areas.sendDraw('undo')} onFinish={() => areas.sendDraw('finish')}
          onCancel={() => { areas.sendDraw('cancel'); areas.stopDrawing(); }} />
      )}

      <KeyboardShortcuts />
    </main>
  );
}
