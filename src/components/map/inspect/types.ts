import type { Airport, AircraftDetail } from '@/lib/flights/watch';
import type { ScheduleReply } from '@/lib/map/popups/layer-popups';

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
}

export interface CameraTarget {
  kind: 'camera';
  id: string;
  camera: CameraInfo;
}

export type InspectTarget = AircraftTarget | ShipTarget | CameraTarget;

/** What the map's click handlers use to open and fill the card. */
export interface InspectSink {
  /** False when the click already opened something under the same point. */
  open: (target: InspectTarget) => boolean;
  patch: <K extends InspectTarget['kind']>(kind: K, id: string, patch: Partial<Extract<InspectTarget, { kind: K }>>) => void;
}
