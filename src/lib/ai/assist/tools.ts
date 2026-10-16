/**
 * TAKIP AI Assist: carrying out what the model asks.
 *
 * The model's actions run in the page, against a small bridge the page
 * provides (Site): fly the camera, switch layers, mark places, open panels,
 * read the live data it holds. Each action is checked before it touches the
 * map: unknown layers and panels are refused, coordinates are bounded, places
 * are looked up. Each comes back as a one-line result for the model and,
 * where there is something to see, a card for the reader.
 *
 * The tools that only read data run against the smaller Lookup, so the MCP
 * server runs the same code over data it fetches (./serve). They hand back
 * what they would mark or where they would fly as effects, which only the
 * page applies.
 */
import type { FeedMark } from '@/lib/core/feed-log';
import type { Boundary } from '@/lib/places/areas/boundaries';
import type { CameraVerb } from '../globe/verbs';
import type { FrameAnalysis, WatchSummary } from '../../intel/vision/analysis';
import type { VisionCamera } from '../../intel/vision/source';
import type { FindLayer } from './catalog';
import type { Bounds, Place } from './query/geo';
import type { Call, CallResult, TrackKind } from './protocol';
import type { ToolName } from './tool-defs';
import { aircraft } from './actions/aircraft';
import { brief } from './actions/brief';
import { forecast, select, workspace } from './actions/forecast';
import { chronicle, pastEvent } from './actions/history';
import { camera } from './actions/look';
import { clear, goTo, layers, link, mapView, move, open, track, untrack } from './actions/navigate';
import { nearby } from './actions/nearby';
import { highlight, markets, show } from './actions/present';
import { route } from './actions/route';
import { find, scanArea } from './actions/search';
import { pass } from './actions/sky';
import { timeline } from './actions/timeline';
import { weather } from './actions/weather';

export { camerasIn } from './actions/look';
export { quotesOf } from './actions/present';
export { findLayer, zoomFor } from './actions/shared';
export type { Place } from './query/geo';

export interface HighlightPoint { lat: number; lng: number; label: string }
export interface HighlightLine {
  /** [lng, lat] pairs. */
  coords: [number, number][];
  label?: string;
  /** An arrow ends in a head; a track or route is a plain line. */
  kind: 'arrow' | 'path' | 'route' | 'track';
}
export interface Highlight {
  points: HighlightPoint[];
  area: { lat: number; lng: number; radiusKm: number; label: string } | null;
  lines?: HighlightLine[];
  outlines?: { geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon; label: string }[];
}

export type Depth = 'quick' | 'standard' | 'deep';

/** Kept for a conversation: what follow-ups and `keep` build on. */
export interface AssistMemo {
  lastFind?: { layers: FindLayer[]; keys: string[] };
  marks?: Highlight | null;
}

/** What the data tools need: the live data, places, and TAKIP's API. */
export interface Lookup {
  data(): Record<string, unknown>;
  geocode(query: string): Promise<Place | null>;
  /** JSON from TAKIP's API by path (or an https address); null for a 404. Default: the browser's fetch. */
  get?(path: string, signal?: AbortSignal): Promise<unknown>;
  /** A form POST to an https service (Overpass), answering JSON. Default: the browser's fetch. */
  post?(url: string, form: string, signal?: AbortSignal): Promise<unknown>;
  /** Makes a layer's data available: the server fetches it. The page switches the layer on and waits instead. */
  ensure?(layer: FindLayer, signal?: AbortSignal): Promise<boolean>;
  /** When each feed last landed. Default: the page's feed log. */
  feeds?(): Record<string, FeedMark>;
  layersOn?(): Record<string, boolean>;
  /** Outlines for a region search. Default: the page's boundary files. */
  regions?: { countries(): Promise<Boundary[]>; admin1(countryId: string): Promise<Boundary[]> };
  memo?: AssistMemo;
  /** Where TAKIP is served, for links. */
  origin?: string;
}

/** What the page lets the assistant do. */
export interface Site extends Lookup {
  view(): { lat: number; lng: number; zoom: number; projection: 'globe' | 'mercator'; style: string; bounds?: Bounds; pitch?: number; bearing?: number };
  layers(): Record<string, boolean>;
  flyTo(lat: number, lng: number, zoom?: number): void;
  setLayers(on: string[], off: string[]): void;
  highlight(h: Highlight | null): void;
  openPanel(panel: string): void;
  closePanel?(panel: string): void;
  setView(v: { projection?: 'globe' | 'mercator'; style?: 'dark' | 'satellite' }): void;
  forecast(question: string, depth: Depth): Promise<{ ok: true; id: string } | { ok: false; error: string }>;
  /** Open or close the full-screen workspace, and set what its stage shows. */
  workspace?(o: { open?: boolean; view?: WorkspaceView }): { ok: true; summary: string } | { ok: false; error: string };
  /** Open an object of the current forecast by name. */
  select?(name: string): { ok: true; summary: string } | { ok: false; error: string };
  /** Open a camera for the reader and look through it with the built-in analysis: one frame, or `watch` seconds of them. */
  camera?(camera: CameraRecord, watch: number): Promise<{ analysis: FrameAnalysis; watch?: WatchSummary }>;
  /** Move the camera from where it is; says what it did. */
  move?(v: CameraVerb): string;
  /** Open a thing's card and keep the camera on it. */
  track?(t: { kind: TrackKind; id: string }): void;
  untrack?(): void;
  /** What is followed now, and whether it has been found yet. */
  tracked?(): { kind: TrackKind; id: string; status: string } | null;
  /** Drive Replay or History, or go back to live. */
  timeline?(t: { mode: 'replay' | 'history' | 'live'; at?: number; play?: boolean; speed?: number }): Promise<{ ok: true; summary: string } | { ok: false; error: string }>;
}

/** A camera as the page holds it. */
export interface CameraRecord extends VisionCamera {
  lat: number;
  lng: number;
  name?: string;
  city?: string;
  country?: string;
  source?: string;
}

export type WorkspaceView = 'globe' | 'graph' | 'timeline' | 'table';

/** Something for the reader to look at in the conversation. */
export interface Card {
  kind: 'find' | 'show' | 'markets' | 'forecast' | 'place' | 'scan' | 'camera' | 'aircraft' | 'weather' | 'pass' | 'brief' | 'route' | 'link' | 'history';
  title: string;
  subtitle?: string;
  items: { label: string; detail?: string; lat?: number; lng?: number; url?: string; value?: string; tone?: 'up' | 'down' }[];
  /** A forecast card follows the run it started. */
  runId?: string;
}

export interface Outcome {
  result: CallResult;
  card?: Card;
  /** What the page should do with it: mark it, fly to it. The server ignores these. */
  effects?: { highlight?: Highlight | null; fly?: { lat: number; lng: number; zoom: number } };
}

type Run = (args: Record<string, unknown>, site: Site, signal?: AbortSignal) => Promise<Outcome> | Outcome;

const PAGE: Record<ToolName, Run> = {
  go_to: goTo, move, layers, find, scan: scanArea, track, untrack, aircraft, weather, pass, brief, route, nearby,
  camera, highlight, show, markets, open, map_view: mapView, timeline, chronicle, past_event: pastEvent, link, forecast, workspace, select, clear,
};

export function applyHighlight(site: Site, h: Highlight | null) {
  site.highlight(h);
  if (site.memo) site.memo.marks = h;
}

export async function runCall(call: Call, site: Site, signal?: AbortSignal): Promise<Outcome> {
  const out = await PAGE[call.tool](call.args, site, signal);
  const fx = out.effects;
  if (fx && out.result.ok) {
    if (fx.highlight !== undefined) applyHighlight(site, fx.highlight);
    if (fx.fly) site.flyTo(fx.fly.lat, fx.fly.lng, Math.round(fx.fly.zoom * 10) / 10);
  }
  return out;
}
