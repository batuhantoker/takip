import type { RefObject } from 'react';
import type * as maplibregl from 'maplibre-gl';
import type { DrawAction, DrawMode, DrawProgress, DrawResult } from '@/lib/draw';
import type { TerrainStatus } from '@/lib/map-terrain';
import type { Highlight } from '@/lib/oi/assist/tools';
import type { OiGlobe, OiHover } from '@/lib/oi/globe';
import type { createSatelliteLayer } from '@/lib/satellite-layer';

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
  /** `alertId` also opens that Live Alert's pin once the camera arrives.
   *  `duration` overrides the default 2 s flight. */
  flyToLocation?: { lat: number; lng: number; zoom?: number; alertId?: string; duration?: number; ts: number } | null;
  /** Fires once, when the map has drawn its first complete frame. */
  onReady?: () => void;
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
  /** Corroborated endpoint airports for watched aircraft, keyed by icao24. */
  aircraftAirports?: Record<string, Array<{ icao: string; iata?: string; city?: string; lat: number; lng: number }>>;
  /** Hands the page OI's globe layer, so a run draws without re-rendering the map. Null when it goes. */
  onOiGlobe?: (globe: OiGlobe | null) => void;
  /** A piece of OI's analysis was clicked: an arc ("link:<id>") or a point ("a:<actor>", "e:<event>"…); null for empty map. */
  onOiSelect?: (key: string | null) => void;
  /** The pointer is over a piece of OI's analysis, or has left it. */
  onOiHover?: (hover: OiHover | null) => void;
  /** OI's camera started or stopped following the run. */
  onOiFollow?: (following: boolean) => void;
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
