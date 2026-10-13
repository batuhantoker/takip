'use client';

import dynamic from 'next/dynamic';
import type { Dispatch, SetStateAction } from 'react';
import { Layers } from 'lucide-react';
import LiveAlerts from '@/components/alerts/live-alerts';
import ArcGISPanel from '@/components/layers/arcgis-panel';
import MarketsPanel from '@/components/markets/markets-panel';
import type { OiPanelProps } from '@/components/oi/oi-panel';
import type { Areas } from '@/components/draw/use-areas';
import type { ArcgisLayers } from '@/components/layers/use-arcgis-layers';
import type { HistorySession } from '@/lib/history/session';
import type { ActiveLayers } from '@/lib/default-layers';
import PanelCard from './panel-card';
import type { ToolId } from './dock';
import type { FlyToTarget, LiveData, MapCenter } from './dashboard-types';

const LayersPane = dynamic(() => import('@/components/layers/layers-pane'));
const SpaceDock = dynamic(() => import('@/components/space/space-dock'), { ssr: false });
const OsintPanel = dynamic(() => import('@/components/recon/osint-panel'));
const OiPanel = dynamic(() => import('@/components/oi/oi-panel'));
const DrawingToolbar = dynamic(() => import('@/components/draw/drawing-toolbar'), { ssr: false });
const HistoryPanel = dynamic(() => import('@/components/history/history-panel'));

/** The panel each sidebar entry opens. Route is not here: its planner stays mounted on its own (see RoutePlanner). */
export default function DockTools({ tool, onClose, data, activeLayers, setActiveLayers, capabilities, layersOn, ti, areas, arcgis, mapBounds,
  setFlyToLocation, setPinnedAlertIds, openFeed, refreshNews, onSweep, onScanGeolocate, spaceWeather, history }: {
  tool: Exclude<ToolId, 'directions'>;
  onClose: () => void;
  data: LiveData;
  activeLayers: ActiveLayers;
  setActiveLayers: Dispatch<SetStateAction<ActiveLayers>>;
  capabilities: Record<string, boolean>;
  layersOn: number;
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
  history: { session: HistorySession | null; open: () => void };
}) {
  const flyTo = (lat: number, lng: number, zoom?: number) => setFlyToLocation({ lat, lng, zoom, ts: Date.now() });
  switch (tool) {
    case 'layers': return (
      <PanelCard title="Layers" icon={Layers} onClose={onClose}
        meta={<span className="text-[11px] font-mono tabular-nums text-[var(--text-muted)]">{layersOn} on</span>}>
        <LayersPane data={data} activeLayers={activeLayers} setActiveLayers={setActiveLayers} capabilities={capabilities} />
      </PanelCard>
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
        watched={areas.watched}
        onToggleWatch={areas.toggleWatch}
        watchEvents={areas.watchEvents}
      />
    );
    case 'alerts': return (
      <LiveAlerts data={data}
        onLocate={(lat, lng, options) => setFlyToLocation({ lat, lng, zoom: options?.zoom, alertId: options?.alertId, ts: Date.now() })}
        pinsOn={activeLayers.alert_pins} onTogglePins={on => setActiveLayers(prev => ({ ...prev, alert_pins: on }))}
        onPinnedChange={setPinnedAlertIds} onWatchFeed={openFeed} onRefresh={refreshNews} />
    );
    case 'recon': return (
      <OsintPanel onSweepVisualize={onSweep} onScanGeolocate={(target, scan) => { onScanGeolocate(target, scan); flyTo(scan.lat, scan.lng); }} />
    );
    case 'space': return <SpaceDock onClose={onClose} />;
    case 'history': return <HistoryPanel session={history.session} onOpen={history.open} onClose={onClose} onFlyTo={v => flyTo(v.lat, v.lng, v.zoom)} />;
    case 'arcgis': return (
      <div className="glass-panel p-3">
        <ArcGISPanel onImportLayer={arcgis.importLayer} onRemoveLayer={arcgis.removeLayer} onUpdateLayer={arcgis.updateLayer}
          importedLayers={arcgis.arcgisLayers} mapBounds={mapBounds ?? null} />
      </div>
    );
    case 'markets': return <MarketsPanel data={data} spaceWeather={spaceWeather} />;
    default: return null;
  }
}
