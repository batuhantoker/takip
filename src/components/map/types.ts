import type { RefObject } from 'react';
import type * as maplibregl from 'maplibre-gl';
import type { DrawAction, DrawMode, DrawProgress, DrawResult } from '@/lib/places/areas/draw';
import type { TerrainStatus } from '@/lib/map/terrain/terrain';
import type { Highlight } from '@/lib/ai/assist/tools';
import type { AiGlobe, AiHover } from '@/lib/ai/globe/attach';
import type { HistorySession } from '@/lib/history/session';
import type { ReplaySession } from '@/lib/map/replay/session';
import type { GlobeLink, GlobeView } from '@/lib/space/globe-match';
import type { createSatelliteLayer } from '@/lib/feeds/satellites/layer';

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
  /** The element sets, when asked for: replay propagates them in the browser. */
  line1?: string;
  line2?: string;
}

export interface ImageryRequest {
  shape: GeoJSON.Polygon | GeoJSON.MultiPolygon;
  name: string;
  seq: number;
}

export interface MapPin { lat: number; lng: number; name?: string }

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
  /** MapLibre options over createMap's own, read once when the map is built. */
  mapOptions?: Partial<maplibregl.MapOptions>;
  /** False leaves out the right-click menu (the embed). */
  contextMenu?: boolean;
  /** Replay mode: ships and aircraft drawn at this session's clock instead of live. */
  replay?: ReplaySession | null;
  /** The clock button in the map controls. */
  onReplayToggle?: () => void;
  /** History mode (the History tab): events and country colouring at this session's clock. Never with `replay`. */
  history?: HistorySession | null;
  /** The event families History shows. */
  historyFamilies?: readonly string[];
  /** Only these event kinds, when History's link asked for some. */
  historyKinds?: readonly string[];
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
  /** The last "Satellite images" ask from the Areas tool; each new one opens the window on that shape. */
  imageryRequest?: ImageryRequest | null;
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
  /** The place a page is about, marked: its frame's camera may be on something else (the ISS). */
  pin?: MapPin | null;
  /** Keep the camera centred on userLocation as it moves. */
  followUser?: boolean;
  /** Fired when the operator pans/zooms/rotates while follow mode is on. */
  onFollowInterrupt?: () => void;
  /** Live navigation: tighter zoom and the map turned to face travel direction. */
  navigating?: boolean;
  /** Hands the page AI's globe layer, so a run draws without re-rendering the map. Null when it goes. */
  onAiGlobe?: (globe: AiGlobe | null) => void;
  /** A piece of AI's analysis was clicked: an arc ("link:<id>") or a point ("a:<actor>", "e:<event>"…); null for empty map. */
  onAiSelect?: (key: string | null) => void;
  /** The pointer is over a piece of AI's analysis, or has left it. */
  onAiHover?: (hover: AiHover | null) => void;
  /** AI's camera started or stopped following the run. */
  onAiFollow?: (following: boolean) => void;
  /** A phone panel sheet is open: the inspect sheet steps aside, one sheet at a time. */
  mobileSheetOpen?: boolean;
  /** Something was opened for inspection (card, satellite or camera): the page can close its own sheet. */
  onInspectOpen?: () => void;
  /** What AI Assist has marked on the map: found things, named places, a searched area. */
  aiHighlight?: Highlight | null;
}

export type MapRef = RefObject<maplibregl.Map | null>;
export type SatelliteLayer = ReturnType<typeof createSatelliteLayer>;
export type SetGeo = (source: string, features: unknown[]) => void;
export type ShowPopup = (coords: maplibregl.LngLatLike | number[], html: string) => maplibregl.Popup | undefined;

export interface LayerHookArgs {
  mapRef: MapRef;
  mapReady: boolean;
  data: WorldMapProps['data'];
  activeLayers: WorldMapProps['activeLayers'];
  setGeo: SetGeo;
}
