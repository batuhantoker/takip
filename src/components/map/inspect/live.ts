import type { FlightLayer } from './types';

/** Where each flight layer's aircraft live in the feed. */
export const FLIGHT_BUCKETS: Record<FlightLayer, string> = {
  'fl-commercial': 'commercial_flights',
  'fl-private': 'private_flights',
  'fl-jets': 'private_jets',
  'fl-military': 'military_flights',
};

export const FLIGHT_LAYER_LABEL: Record<FlightLayer, string> = {
  'fl-commercial': 'Commercial',
  'fl-private': 'Private',
  'fl-jets': 'Business jet',
  'fl-military': 'Military',
};

export interface LiveFlight {
  icao24: string;
  callsign?: string;
  lat: number;
  lng: number;
  alt?: number;
  speed_knots?: number;
  heading?: number;
  model?: string;
  registration?: string;
  grounded?: boolean;
  squawk?: string;
  /** ADS-B emergency status, when not `none`. */
  emergency?: string;
}

export interface LiveShip {
  mmsi: number | string;
  name?: string;
  type?: string;
  lat: number;
  lng: number;
  speed?: number;
  heading?: number;
  destination?: string;
  flag?: string;
}

type Feed = Record<string, unknown>;

/** The aircraft in the latest feed, in whichever bucket it is now. */
export function findFlight(data: Feed, icao24: string): { flight: LiveFlight; layer: FlightLayer } | null {
  if (!icao24) return null;
  for (const layer of Object.keys(FLIGHT_BUCKETS) as FlightLayer[]) {
    const list = data[FLIGHT_BUCKETS[layer]] as LiveFlight[] | undefined;
    const flight = list?.find(f => f?.icao24 === icao24);
    if (flight) return { flight, layer };
  }
  return null;
}

export function findShip(data: Feed, mmsi: string): LiveShip | null {
  const list = data.maritime_ships as LiveShip[] | undefined;
  return list?.find(s => String(s?.mmsi) === mmsi) ?? null;
}
