import type { RefObject } from 'react';
import type * as maplibregl from 'maplibre-gl';
import type { DrawAction, DrawMode, DrawProgress, DrawResult } from '@/lib/areas/draw';
import type { TerrainStatus } from '@/lib/map/terrain/terrain';
import type { Highlight } from '@/lib/oi/assist/tools';
import type { OiGlobe, OiHover } from '@/lib/oi/globe';
import type { HistorySession } from '@/lib/history/session';
import type { ReplaySession } from '@/lib/replay/session';
import type { GlobeLink, GlobeView } from '@/lib/space/globe-match';
import type { createSatelliteLayer } from '@/lib/satellites/layer';

/** The catalogue fields the satellite layer and its popup actually read. */
export interface SatelliteRow {
  name: string;
  lat: number;
  lng: number;
  alt: number;
  color?: string;
  mission?: string;
  category?: string;
  noradId?: string;
}

export interface WorldMapProps {
  data: any;
  activeLayers: Record<string, boolean>;
  onEntityClick?: (entity: any) => void;
  onMouseCoords?: (coords: { lat: number; lng: number }) => void;
  onRightClick?: (coords: { lat: number; lng: number }) => void;
  onViewStateChange?: (vs: { zoom: number; latitude: number }) => void;
  /** `alertId` also opens that Live Alert's pin once the camera arrives, and `onArrive` runs then.
   *  `duration` overrides the default 2 s flight; `offset` lands the target that many pixels from the centre. */
  flyToLocation?: { lat: number; lng: number; zoom?: number; alertId?: string; duration?: number; offset?: [number, number]; onArrive?: () => void; ts: number } | null;
  /** Fires once, when the map has drawn its first complete frame. */
  onReady?: () => void;
  /** Replay mode: ships and aircraft drawn at this session's clock instead of live. */
  replay?: ReplaySession | null;
  /** The clock button in the map controls. */
  onReplayToggle?: () => void;
  /** History mode (the History tab): events and country colouring at this session's clock. Never with `replay`. */
  history?: HistorySession | null;
  /** The event families History shows. */
  historyFamilies?: readonly string[];
  /** Which Live Alerts to pin — the reports the feed is showing. Null pins them all. */
  alertPinIds?: string[] | null;
  projection?: 'mercator' | 'globe';
  terrainEnabled?: boolean;
  terrainRetry?: number;
  terrainFocus?: number;
  onTerrainStatusChange?: (status: TerrainStatus) => void;

  mapStyle?: string;
  sweepData?: any;
  scanTargets?: any[];
  demoMode?: boolean;
  theme?: 'core' | 'ghost';
  drawnPolygons?: Array<{ id: string; name: string; geojson: GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon | GeoJSON.LineString>; color: string; meta?: { label?: [number, number] } }>;
  arcgisLayers?: Array<{ id: string; title: string; geojson: any; color?: string; opacity?: number }>;
  /** Active draw mode, or null when not drawing. */
  drawMode?: DrawMode | null;
  onDrawProgress?: (p: DrawProgress | null) => void;
  onDrawCancel?: () => void;
  /**
   * Undo / finish / cancel driven from a button rather than the keyboard.
   * Carries a seq so pressing the same button twice still registers.
   */
  drawCommand?: { action: DrawAction["type"]; seq: number } | null;
  onDrawComplete?: (result: DrawResult) => void;
  onMapCenter?: (coords: { lat: number; lng: number; bounds?: { west: number; south: number; east: number; north: number } }) => void;
  /** Zooming out past the whole globe: the page leaves the map for space, from this exact view. */
  onZoomPastGlobe?: (view: GlobeView) => void;
  /** The globe is nearly whole: a hint to fetch the space view ahead. */
  onNearGlobe?: () => void;
  /** The live map for the space view to read and move on its way back down. */
  onGlobeLink?: (link: GlobeLink | null) => void;
  /** Active turn-by-turn route drawn as a line with origin/destination pins. */
  route?: {
    geometry: { type: 'LineString'; coordinates: [number, number][] };
    from: { lat: number; lng: number };
    to: { lat: number; lng: number };
    /** Unselected alternatives, drawn dimmed behind the active line. */
    alternates?: Array<{ type: 'LineString'; coordinates: [number, number][] }>;
    /** Highlighted portion for the step the operator has selected. */
    activeSegment?: [number, number][] | null;
  } | null;
  /** Live position from the browser — drawn as a pulsing dot with accuracy ring. */
  userLocation?: { lat: number; lng: number; accuracy?: number; heading?: number | null } | null;
  /** Keep the camera centred on userLocation as it moves. */
  followUser?: boolean;
  /** Fired when the operator pans/zooms/rotates while follow mode is on. */
  onFollowInterrupt?: () => void;
  /** Live navigation: tighter zoom and the map turned to face travel direction. */
  navigating?: boolean;
  /** Hands the page OI's globe layer, so a run draws without re-rendering the map. Null when it goes. */
  onOiGlobe?: (globe: OiGlobe | null) => void;
  /** A piece of OI's analysis was clicked: an arc ("link:<id>") or a point ("a:<actor>", "e:<event>"…); null for empty map. */
  onOiSelect?: (key: string | null) => void;
  /** The pointer is over a piece of OI's analysis, or has left it. */
  onOiHover?: (hover: OiHover | null) => void;
  /** OI's camera started or stopped following the run. */
  onOiFollow?: (following: boolean) => void;
  /** A phone panel sheet is open: the inspect sheet steps aside, one sheet at a time. */
  mobileSheetOpen?: boolean;
  /** Something was opened for inspection (card, satellite or camera): the page can close its own sheet. */
  onInspectOpen?: () => void;
  /** What OI Assist has marked on the map: found things, named places, a searched area. */
  oiHighlight?: Highlight | null;
}

export type MapRef = RefObject<maplibregl.Map | null>;
export type SatelliteLayer = ReturnType<typeof createSatelliteLayer>;
export type SetGeo = (source: string, features: unknown[]) => void;
export type ShowPopup = (coords: maplibregl.LngLatLike | number[], html: string) => void;

export interface LayerHookArgs {
  mapRef: MapRef;
  mapReady: boolean;
  data: WorldMapProps['data'];
  activeLayers: WorldMapProps['activeLayers'];
  setGeo: SetGeo;
}
