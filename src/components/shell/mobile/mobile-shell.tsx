'use client';

import dynamic from 'next/dynamic';
import { useEffect, type Dispatch, type SetStateAction } from 'react';
import IntelFeed from '@/components/panels/alerts/intel-feed';
import { HistoryBackToLive, WhereInTime } from '@/components/panels/history/parts/where-in-time';
import MarketsPanel from '@/components/panels/markets/markets-panel';
import SearchBar from '@/components/shell/search/search-bar';
import ViewPresets from '@/components/map/controls/view-presets';
import type { PlaceLike } from '@/components/shell/search/places';
import type { AiPanelProps } from '@/components/panels/ti-agent/ti-panel';
import type { Directions } from '@/components/panels/route/use-directions';
import type { HistorySession } from '@/lib/history/session';
import type { ActiveLayers } from '@/lib/map/layers/defaults';
import { onWorldRequest } from '@/lib/space/world-events';
import type { TerrainStatus } from '@/lib/map/terrain/terrain';
import { useShown } from '@/components/shell/layout/use-page-layout';
import AppHeader from './app-header';
import SharePanel from './share-panel';
import MobileNav from './mobile-nav';
import { MobileDrawer } from './mobile-drawer';
import { MobileStatus, trackedCount } from '@/components/shell/status-bar/status-cluster';
import type { ThemeId } from '@/components/shell/map-look/use-theme';
import type { FlyToTarget, LiveData, MapCenter, MapView, MobilePanel } from '@/components/shell/state/types';

const LayerPanel = dynamic(() => import('@/components/panels/layers/layers-mobile'));
const OsintPanel = dynamic(() => import('@/components/panels/recon/recon-panel'));
const AiPanel = dynamic(() => import('@/components/panels/ti-agent/ti-panel'));
const HistoryPanel = dynamic(() => import('@/components/panels/history/history-panel'));
const SpacePanel = dynamic(() => import('@/components/panels/space/space-panel'), { ssr: false });

/** The phone's view: the mark, More and the account up top, the bottom bar, and the one sheet it opens. */
export default function MobileShell({ revealed, mobilePanel, setMobilePanel, directions, data, activeLayers, setActiveLayers, capabilities,
  terrain, theme, setTheme, ti, spaceWeather, mapCenter, mapView, openDirectionsTo, setFlyToLocation, onSweep, history }: {
  revealed: boolean;
  mobilePanel: MobilePanel | null;
  setMobilePanel: Dispatch<SetStateAction<MobilePanel | null>>;
  directions: Directions;
  data: LiveData;
  activeLayers: ActiveLayers;
  setActiveLayers: Dispatch<SetStateAction<ActiveLayers>>;
  capabilities: Record<string, boolean>;
  terrain: { terrainStatus: TerrainStatus; on3DModeSelected: () => void; onTerrainRetry: () => void; onTerrainFocus: () => void };
  theme: ThemeId;
  setTheme: (theme: ThemeId) => void;
  ti: AiPanelProps;
  spaceWeather: any;
  mapCenter: MapCenter | null;
  mapView: MapView;
  openDirectionsTo: (p: PlaceLike) => void;
  setFlyToLocation: Dispatch<SetStateAction<FlyToTarget | null>>;
  onSweep: (data: any) => void;
  history: { session: HistorySession | null; open: () => void; exit: () => void };
}) {
  const flyAndClose = (lat: number, lng: number, zoom?: number) => {
    setFlyToLocation({ lat, lng, zoom, ts: Date.now() });
    setMobilePanel(null);
  };
  const tracked = trackedCount(data);
  const shown = useShown();
  // Like the sidebar's History tab, opening the sheet starts History.
  const choose = (panel: MobilePanel | null) => {
    if (panel === 'history') history.open();
    setMobilePanel(panel);
  };
  // A spacecraft picked in the Space sheet flies the space view to it; the sheet would hide it.
  useEffect(() => onWorldRequest(() => setMobilePanel(p => (p === 'space' ? null : p))), [setMobilePanel]);
  const subtitle = mobilePanel === 'layers' && tracked > 0 ? `${tracked.toLocaleString('en-US')} tracked on the map`
    : mobilePanel === 'history' && history.session ? <WhereInTime session={history.session} />
      : undefined;

  return (
    <>
      {shown('logo') && <AppHeader revealed={revealed} />}
      {/* The route planner claims the top of the screen; this would sit under its destination field. */}
      {!directions.showDirections && !directions.navSession && <MobileStatus revealed={revealed} onOpenMarkets={() => setMobilePanel('markets')} />}

      <MobileNav mobilePanel={mobilePanel} setMobilePanel={choose} showDirections={directions.showDirections}
        setShowDirections={directions.setShowDirections} navSession={directions.navSession} setActiveRoute={directions.setActiveRoute} />

      <MobileDrawer mobilePanel={mobilePanel} setMobilePanel={setMobilePanel} subtitle={subtitle}
        actions={mobilePanel === 'history' && history.session && <HistoryBackToLive onExit={history.exit} />}>
        {mobilePanel === 'layers' && (
          <>
            <LayerPanel {...terrain} data={data} activeLayers={activeLayers} setActiveLayers={setActiveLayers} theme={theme} setTheme={setTheme} capabilities={capabilities} />
            <div className="mt-6">
              <ViewPresets onNavigate={flyAndClose} />
            </div>
          </>
        )}
        {mobilePanel === 'markets' && <MarketsPanel data={data} spaceWeather={spaceWeather} />}
        {mobilePanel === 'ai' && <AiPanel {...ti} embedded />}
        {mobilePanel === 'intel' && <IntelFeed data={data} onLocate={(lat, lng) => flyAndClose(lat, lng)} />}
        {mobilePanel === 'history' && (
          <HistoryPanel embedded session={history.session} onOpen={history.open} onExit={history.exit} onClose={() => setMobilePanel(null)}
            onFlyTo={(v, onArrive) => { setFlyToLocation({ ...v, onArrive, ts: Date.now() }); setMobilePanel(null); }} />
        )}
        {mobilePanel === 'space' && <SpacePanel embedded onClose={() => setMobilePanel(null)} />}
        {mobilePanel === 'search' && (
          <>
            <SearchBar embedded center={mapCenter} onDirections={openDirectionsTo} onLocate={flyAndClose} />
            <SharePanel center={mapCenter} zoom={mapView.zoom} activeLayers={activeLayers} />
          </>
        )}
        {mobilePanel === 'recon' && (
          <OsintPanel isMobile onSweepVisualize={onSweep} />
        )}
      </MobileDrawer>
    </>
  );
}
