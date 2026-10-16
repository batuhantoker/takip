import type { Airport, AircraftDetail } from '@/lib/feeds/aviation/flight-watch';
import type { ScheduleReply } from '@/lib/map/popups/layer-popups';
import type { TransitMode } from '@/lib/feeds/transit/modes';

export type FlightLayer = 'fl-commercial' | 'fl-private' | 'fl-jets' | 'fl-military';

export type RouteState =
  | { status: 'loading' }
  | { status: 'none' | 'mismatch' | 'unavailable'; tracked: boolean }
  | { status: 'found'; origin: Airport | null; destination: Airport | null; schedule: ScheduleReply | null; landed: boolean };

export interface AircraftTarget {
  kind: 'aircraft';
  id: string;
  icao24: string;
  callsign: string;
  layer: FlightLayer;
  lng: number;
  lat: number;
  alt?: number;
  speed?: number;
  heading?: number;
  model?: string;
  registration?: string;
  airframe: AircraftDetail | null | 'loading' | 'unavailable';
  route: RouteState;
}

export interface ShipTarget {
  kind: 'ship';
  id: string;
  mmsi: string;
  name: string;
  type: string;
  lng: number;
  lat: number;
  speed?: number;
  heading?: number;
  destination?: string;
  flag?: string;
}

/** A bus, tram or train from /api/transit; `id` is the vehicle key, `feed` the feed's name. */
export interface TransitTarget {
  kind: 'transit';
  id: string;
  lng: number;
  lat: number;
  route?: string;
  trip?: string;
  label?: string;
  plate?: string;
  operator?: string;
  feed?: string;
  license?: string;
  bearing?: number;
  speed?: number;
  status?: number;
  /** Seconds since the vehicle reported, when it was clicked. */
  age?: number;
  mode?: TransitMode;
  /** Placed from its stops, not GPS: the stop it is at or heading to, and the one it left. */
  stop?: string;
  from?: string;
  estimated?: boolean;
  scheduled?: boolean;
}

/** The camera as the map and the player pass it around. */
export interface CameraInfo {
  id: string;
  name: string;
  lat: number;
  lng: number;
  city?: string;
  country?: string;
  source?: string;
  feed_url?: string;
  stream_url?: string;
  stream_type?: string;
  external_url?: string;
  road?: string;
  offline?: boolean;
}

export interface CameraTarget {
  kind: 'camera';
  id: string;
  camera: CameraInfo;
}

export type InspectTarget = AircraftTarget | ShipTarget | TransitTarget | CameraTarget;

/** What the map's click handlers use to open and fill the card. */
export interface InspectSink {
  /** False when the click already opened something under the same point. */
  open: (target: InspectTarget) => boolean;
  patch: <K extends InspectTarget['kind']>(kind: K, id: string, patch: Partial<Extract<InspectTarget, { kind: K }>>) => void;
}
