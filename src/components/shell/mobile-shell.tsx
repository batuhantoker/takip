'use client';

import dynamic from 'next/dynamic';
import type { Dispatch, SetStateAction } from 'react';
import IntelFeed from '@/components/alerts/intel-feed';
import MarketsPanel from '@/components/markets/markets-panel';
import SearchBar from '@/components/search/search-bar';
import ViewPresets from '@/components/map/view-presets';
import type { PlaceLike } from '@/components/search/places';
import type { OiPanelProps } from '@/components/oi/oi-panel';
import type { Directions } from '@/components/directions/use-directions';
import type { ActiveLayers } from '@/lib/default-layers';
import type { TerrainStatus } from '@/lib/map-terrain';
import AppHeader from './app-header';
import SharePanel from './share-panel';
import MobileNav from './mobile-nav';
import { MobileDrawer, MobileStats } from './mobile-drawer';
import { MobileStatus } from './status-cluster';
import type { ThemeId } from './use-theme';
import type { FlyToTarget, LiveData, MapCenter, MapView, MobilePanel } from './dashboard-types';

const LayerPanel = dynamic(() => import('@/components/layers/layer-panel'));
const OsintPanel = dynamic(() => import('@/components/recon/osint-panel'));
const OiPanel = dynamic(() => import('@/components/oi/oi-panel'));

/** The phone's reduced view: header, status, bottom nav and the drawer it opens. */
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
  const totalFlights = ['commercial_flights', 'private_flights', 'private_jets', 'military_flights']
    .reduce((sum, key) => sum + (data[key]?.length || 0), 0);

  return (
    <>
      <AppHeader revealed={revealed} isMobile />
      {/* The route planner claims the top of the screen; this would sit under its destination field. */}
      {!directions.showDirections && !directions.navSession && <MobileStatus revealed={revealed} onOpenMarkets={() => setMobilePanel('markets')} />}

      <MobileNav mobilePanel={mobilePanel} setMobilePanel={setMobilePanel} showDirections={directions.showDirections}
        setShowDirections={directions.setShowDirections} navSession={directions.navSession} setActiveRoute={directions.setActiveRoute} />

      <MobileDrawer mobilePanel={mobilePanel} setMobilePanel={setMobilePanel}>
        {mobilePanel === 'layers' && (
          <>
            <MobileStats totalFlights={totalFlights} data={data} />
            <LayerPanel {...terrain} data={data} activeLayers={activeLayers} setActiveLayers={setActiveLayers} theme={theme} setTheme={setTheme} capabilities={capabilities} />
            <div className="mt-8">
              <ViewPresets onNavigate={flyAndClose} />
            </div>
          </>
        )}
        {mobilePanel === 'markets' && <MarketsPanel data={data} spaceWeather={spaceWeather} />}
        {mobilePanel === 'oi' && <OiPanel {...ti} embedded />}
        {mobilePanel === 'intel' && <IntelFeed data={data} onLocate={(lat, lng) => flyAndClose(lat, lng)} />}
        {mobilePanel === 'search' && (
          <div className="space-y-2">
            <SearchBar embedded center={mapCenter} onDirections={openDirectionsTo} onLocate={flyAndClose} />
            <SharePanel mapView={mapView} activeLayers={activeLayers} mouseCoords={null} />
          </div>
        )}
        {mobilePanel === 'recon' && (
          <div className="space-y-2">
            <OsintPanel isMobile onSweepVisualize={onSweep} />
          </div>
        )}
      </MobileDrawer>
    </>
  );
}
