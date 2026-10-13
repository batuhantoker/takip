'use client';

import dynamic from 'next/dynamic';
import type { Dispatch, SetStateAction } from 'react';
import LiveAlerts from '@/components/panels/alerts/alerts-panel';
import ArcGISPanel from '@/components/panels/arcgis/arcgis-panel';
import MarketsPanel from '@/components/panels/markets/markets-panel';
import type { OiPanelProps } from '@/components/panels/ti-agent/ti-panel';
import type { Areas } from '@/components/panels/areas/use-areas';
import type { ArcgisLayers } from '@/components/panels/arcgis/use-arcgis-layers';
import type { HistorySession } from '@/lib/history/session';
import type { ActiveLayers } from '@/lib/layers/defaults';
import type { ToolId } from './dock';
import type { FlyToTarget, LiveData, MapCenter } from '@/components/shell/state/types';

const LayersPane = dynamic(() => import('@/components/panels/layers/layers-panel'));
const SpaceDock = dynamic(() => import('@/components/panels/space/space-panel'), { ssr: false });
const OsintPanel = dynamic(() => import('@/components/panels/recon/recon-panel'));
const OiPanel = dynamic(() => import('@/components/panels/ti-agent/ti-panel'));
const DrawingToolbar = dynamic(() => import('@/components/panels/areas/areas-panel'), { ssr: false });
const HistoryPanel = dynamic(() => import('@/components/panels/history/history-panel'));

/** The panel each sidebar entry opens. Route is not here: its planner stays mounted on its own (see RoutePlanner). */
export default function DockTools({ tool, onClose, data, activeLayers, setActiveLayers, capabilities, ti, areas, arcgis, mapBounds,
  setFlyToLocation, setPinnedAlertIds, openFeed, refreshNews, onSweep, onScanGeolocate, spaceWeather, history }: {
  tool: Exclude<ToolId, 'directions'>;
  onClose: () => void;
  data: LiveData;
  activeLayers: ActiveLayers;
  setActiveLayers: Dispatch<SetStateAction<ActiveLayers>>;
  capabilities: Record<string, boolean>;
  /** The TI panel's props, already set up for the desktop. */
  ti: OiPanelProps;
  areas: Areas;
  arcgis: ArcgisLayers;
  mapBounds: MapCenter['bounds'] | null;
  setFlyToLocation: Dispatch<SetStateAction<FlyToTarget | null>>;
  setPinnedAlertIds: (ids: string[]) => void;
  openFeed: (url: string, name: string) => void;
  refreshNews: () => void;
  onSweep: (data: any) => void;
  onScanGeolocate: (target: string, data: any) => void;
  spaceWeather: any;
  history: { session: HistorySession | null; open: () => void; exit: () => void };
}) {
  const flyTo = (lat: number, lng: number, zoom?: number) => setFlyToLocation({ lat, lng, zoom, ts: Date.now() });
  switch (tool) {
    case 'layers': return (
      <LayersPane data={data} activeLayers={activeLayers} setActiveLayers={setActiveLayers} capabilities={capabilities} onClose={onClose} />
    );
    case 'oi': return <OiPanel {...ti} />;
    case 'draw': return (
      <DrawingToolbar
        drawMode={areas.drawMode}
        onSetDrawMode={areas.setDrawMode}
        progress={areas.drawProgress}
        polygons={areas.drawnPolygons}
        onDeletePolygon={(id) => areas.setDrawnPolygons(p => p.filter(x => x.id !== id))}
        onClearAll={() => { areas.setDrawnPolygons([]); areas.setSelectedPolygon(null); }}
        onExportGeoJSON={areas.exportGeoJSON}
        selectedPolygon={areas.selectedPolygon}
        onSelectPolygon={areas.setSelectedPolygon}
        onRenamePolygon={(id, name) => areas.setDrawnPolygons(p => p.map(x => (x.id === id ? { ...x, name } : x)))}
        data={data}
        onLocateEntity={(lat, lng) => flyTo(lat, lng, 12)}
        onLocateArea={flyTo}
        onRestore={areas.setDrawnPolygons}
        watched={areas.watched}
        onToggleWatch={areas.toggleWatch}
        watchEvents={areas.watchEvents}
        onClose={onClose}
      />
    );
    case 'alerts': return (
      <LiveAlerts data={data} onClose={onClose}
        onLocate={(lat, lng, options) => setFlyToLocation({ lat, lng, zoom: options?.zoom, alertId: options?.alertId, ts: Date.now() })}
        pinsOn={activeLayers.alert_pins} onTogglePins={on => setActiveLayers(prev => ({ ...prev, alert_pins: on }))}
        onPinnedChange={setPinnedAlertIds} onWatchFeed={openFeed} onRefresh={refreshNews} />
    );
    case 'recon': return (
      <OsintPanel onClose={onClose} onSweepVisualize={onSweep} onScanGeolocate={(target, scan) => { onScanGeolocate(target, scan); flyTo(scan.lat, scan.lng); }} />
    );
    case 'space': return <SpaceDock onClose={onClose} />;
    case 'history': return <HistoryPanel session={history.session} onOpen={history.open} onClose={onClose} onExit={history.exit} onFlyTo={v => flyTo(v.lat, v.lng, v.zoom)} />;
    case 'arcgis': return (
      <ArcGISPanel onImportLayer={arcgis.importLayer} onRemoveLayer={arcgis.removeLayer} onUpdateLayer={arcgis.updateLayer}
        importedLayers={arcgis.arcgisLayers} mapBounds={mapBounds ?? null} onClose={onClose} />
    );
    case 'markets': return <MarketsPanel data={data} spaceWeather={spaceWeather} onClose={onClose} />;
    default: return null;
  }
}
