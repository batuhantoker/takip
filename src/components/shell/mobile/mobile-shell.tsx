'use client';

import dynamic from 'next/dynamic';
import type { Dispatch, SetStateAction } from 'react';
import IntelFeed from '@/components/panels/alerts/intel-feed';
import MarketsPanel from '@/components/panels/markets/markets-panel';
import SearchBar from '@/components/shell/search/search-bar';
import ViewPresets from '@/components/map/controls/view-presets';
import type { PlaceLike } from '@/components/shell/search/places';
import type { OiPanelProps } from '@/components/panels/ti-agent/ti-panel';
import type { Directions } from '@/components/panels/route/use-directions';
import type { ActiveLayers } from '@/lib/layers/defaults';
import type { TerrainStatus } from '@/lib/map/terrain/terrain';
import AppHeader from './app-header';
import SharePanel from './share-panel';
import MobileNav from './mobile-nav';
import { MobileDrawer } from './mobile-drawer';
import { MobileStatus, trackedCount } from '@/components/shell/status-bar/status-cluster';
import type { ThemeId } from '@/components/shell/map-look/use-theme';
import type { FlyToTarget, LiveData, MapCenter, MapView, MobilePanel } from '@/components/shell/state/types';

const LayerPanel = dynamic(() => import('@/components/panels/layers/layers-mobile'));
const OsintPanel = dynamic(() => import('@/components/panels/recon/recon-panel'));
const OiPanel = dynamic(() => import('@/components/panels/ti-agent/ti-panel'));

/** The phone's view: the mark, More and the account up top, the bottom bar, and the one sheet it opens. */
export default function MobileShell({ revealed, mobilePanel, setMobilePanel, directions, data, activeLayers, setActiveLayers, capabilities,
  terrain, theme, setTheme, ti, spaceWeather, mapCenter, mapView, openDirectionsTo, setFlyToLocation, onSweep }: {
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
  ti: OiPanelProps;
  spaceWeather: any;
  mapCenter: MapCenter | null;
  mapView: MapView;
  openDirectionsTo: (p: PlaceLike) => void;
  setFlyToLocation: Dispatch<SetStateAction<FlyToTarget | null>>;
  onSweep: (data: any) => void;
}) {
  const flyAndClose = (lat: number, lng: number, zoom?: number) => {
    setFlyToLocation({ lat, lng, zoom, ts: Date.now() });
    setMobilePanel(null);
  };
  const tracked = trackedCount(data);

  return (
    <>
      <AppHeader revealed={revealed} />
      {/* The route planner claims the top of the screen; this would sit under its destination field. */}
      {!directions.showDirections && !directions.navSession && <MobileStatus revealed={revealed} onOpenMarkets={() => setMobilePanel('markets')} />}

      <MobileNav mobilePanel={mobilePanel} setMobilePanel={setMobilePanel} showDirections={directions.showDirections}
        setShowDirections={directions.setShowDirections} navSession={directions.navSession} setActiveRoute={directions.setActiveRoute} />

      <MobileDrawer mobilePanel={mobilePanel} setMobilePanel={setMobilePanel}
        subtitle={mobilePanel === 'layers' && tracked > 0 ? `${tracked.toLocaleString('en-US')} tracked on the map` : undefined}>
        {mobilePanel === 'layers' && (
          <>
            <LayerPanel {...terrain} data={data} activeLayers={activeLayers} setActiveLayers={setActiveLayers} theme={theme} setTheme={setTheme} capabilities={capabilities} />
            <div className="mt-6">
              <ViewPresets onNavigate={flyAndClose} />
            </div>
          </>
        )}
        {mobilePanel === 'markets' && <MarketsPanel data={data} spaceWeather={spaceWeather} />}
        {mobilePanel === 'oi' && <OiPanel {...ti} embedded />}
        {mobilePanel === 'intel' && <IntelFeed data={data} onLocate={(lat, lng) => flyAndClose(lat, lng)} />}
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
