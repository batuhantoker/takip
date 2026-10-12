import { httpJson } from '@takip/connectors/http-json';
import type { DirectionStep, DirectionsResult, TravelMode } from './schemas';

// The public demo carries only the driving profile, and ships no instruction text.
const OSRM = 'https://router.project-osrm.org/route/v1';

export interface OsrmStep {
  name?: string;
  distance?: number;
  duration?: number;
  maneuver?: { type?: string; modifier?: string; exit?: number; location?: [number, number] };
}
export interface OsrmResponse {
  routes?: Array<{
    distance?: number;
    duration?: number;
    geometry?: { coordinates?: [number, number][] };
    legs?: Array<{ steps?: OsrmStep[] }>;
  }>;
}

/** Instruction text from type, modifier and street name, the way osrm-text-instructions builds it. */
export function osrmInstruction(step: OsrmStep): string {
  const type: string = step?.maneuver?.type || '';
  const modifier: string = step?.maneuver?.modifier || '';
  const road: string = (step?.name || '').trim();
  const onto = road ? ` onto ${road}` : '';

  switch (type) {
    case 'depart':
      return road ? `Head out on ${road}` : 'Depart';
    case 'arrive':
      return 'You have arrived at your destination';
    case 'roundabout':
    case 'rotary':
      return step?.maneuver?.exit
        ? `At the roundabout, take exit ${step.maneuver.exit}${onto}`
        : `Enter the roundabout${onto}`;
    case 'merge':
      return `Merge${modifier ? ` ${modifier}` : ''}${onto}`;
    case 'on ramp':
      return `Take the ramp${onto}`;
    case 'off ramp':
      return `Take the exit${onto}`;
    case 'fork':
      return `Keep ${modifier || 'straight'}${onto}`;
    case 'end of road':
      return `Turn ${modifier || 'straight'}${onto}`;
    case 'continue':
      return modifier && modifier !== 'straight' ? `Keep ${modifier}${onto}` : `Continue${onto}`;
    case 'new name':
      return `Continue${onto}`;
    case 'turn':
    default:
      return modifier ? `Turn ${modifier}${onto}` : `Continue${onto}`;
  }
}

export function normalizeOsrm(json: OsrmResponse, mode: TravelMode): DirectionsResult | null {
  const route = json?.routes?.[0];
  if (!route?.geometry?.coordinates?.length) return null;

  const steps: DirectionStep[] = [];
  for (const leg of route.legs || []) {
    for (const s of leg.steps || []) {
      steps.push({
        instruction: osrmInstruction(s),
        distance: s.distance || 0,
        duration: s.duration || 0,
        location: (s.maneuver?.location as [number, number]) || [0, 0],
        type: s.maneuver?.modifier || s.maneuver?.type || 'straight',
      });
    }
  }

  return {
    provider: 'osrm',
    mode,
    distance: route.distance || 0,
    duration: route.duration || 0,
    geometry: { type: 'LineString', coordinates: route.geometry.coordinates },
    steps,
  };
}

export async function tryOsrm(points: Array<{ lat: number; lng: number }>, mode: TravelMode): Promise<DirectionsResult[]> {
  const coords = points.map((p) => `${p.lng},${p.lat}`).join(';');
  const url = `${OSRM}/driving/${coords}?steps=true&overview=full&geometries=geojson`;
  const r = normalizeOsrm(await httpJson<OsrmResponse>(url), mode);
  return r ? [r] : [];
}
