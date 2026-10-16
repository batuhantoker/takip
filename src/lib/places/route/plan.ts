export interface RouteStep {
  instruction: string;
  distance: number;
  duration: number;
  location: [number, number];
  type: string;
}

export interface RouteResult {
  provider: string;
  mode: string;
  distance: number;
  duration: number;
  geometry: { type: 'LineString'; coordinates: [number, number][] };
  steps: RouteStep[];
  /** All options the engine offered, best first. Present on the API response. */
  routes?: RouteResult[];
  hasHighway?: boolean;
  hasToll?: boolean;
  hasFerry?: boolean;
  elevation?: Array<{ distance: number; height: number }>;
  ascent?: number;
  descent?: number;
}

export interface LiveLocation {
  lat: number;
  lng: number;
  accuracy?: number;
  heading?: number | null;
}

export interface Place {
  label: string;
  lat: number;
  lng: number;
  /** Secondary line, e.g. "Avenue Anatole France, Paris, France". */
  context?: string;
  /** poi | address | street | city | region | country | coordinate | current */
  kind?: string;
}

export function formatDistance(m: number): string {
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(m < 10000 ? 1 : 0)} km`;
}

/** Metres between two WGS84 points. */
export function haversine(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371000;
  const p = Math.PI / 180;
  const dLat = (bLat - aLat) * p;
  const dLng = (bLng - aLng) * p;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * p) * Math.cos(bLat * p) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
}

/** Index of the route vertex closest to a point. */
function nearestVertex(coords: [number, number][], lat: number, lng: number): number {
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < coords.length; i++) {
    const d = (coords[i][1] - lat) ** 2 + (coords[i][0] - lng) ** 2;
    if (d < bestD) { bestD = d; best = i; }
  }
  return best;
}

/**
 * The maneuver the operator is heading into.
 *
 * Nearest-maneuver is the wrong rule: 160 m past a depart point, the closest
 * maneuver is still the one behind you. Progress along the route decides it —
 * project the position onto the route line, then take the first maneuver that
 * lies further along than that.
 */
export function nextManeuver(
  steps: RouteStep[],
  coords: [number, number][],
  lat: number,
  lng: number,
): { step: RouteStep; index: number; distance: number } | null {
  if (!steps.length) return null;
  if (!coords.length) return { step: steps[0], index: 0, distance: haversine(lat, lng, steps[0].location[1], steps[0].location[0]) };

  const here = nearestVertex(coords, lat, lng);
  for (let i = 0; i < steps.length; i++) {
    const at = nearestVertex(coords, steps[i].location[1], steps[i].location[0]);
    if (at > here) {
      return { step: steps[i], index: i, distance: haversine(lat, lng, steps[i].location[1], steps[i].location[0]) };
    }
  }
  // Past the last maneuver — the destination is what remains.
  const last = steps.length - 1;
  return { step: steps[last], index: last, distance: haversine(lat, lng, steps[last].location[1], steps[last].location[0]) };
}

/** Build an SVG path for the elevation profile, normalised into a viewbox. */
export function elevationPath(
  points: Array<{ distance: number; height: number }>,
  width: number,
  height: number,
): string {
  if (points.length < 2) return '';
  const maxD = points[points.length - 1].distance || 1;
  const hs = points.map((p) => p.height);
  const lo = Math.min(...hs);
  const hi = Math.max(...hs);
  const span = hi - lo || 1;
  return points
    .map((p, i) => {
      const x = (p.distance / maxD) * width;
      const y = height - ((p.height - lo) / span) * height;
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}

/** Wall-clock arrival time for a trip of `seconds` starting now. */
export function arrivalTime(seconds: number, now: Date = new Date()): string {
  const at = new Date(now.getTime() + seconds * 1000);
  return at.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/**
 * Slice the route geometry between two step positions, so selecting a step can
 * highlight the leg it covers rather than just dropping a pin on its start.
 */
export function segmentBetween(
  coords: [number, number][],
  from: [number, number],
  to?: [number, number],
): [number, number][] {
  const nearest = (t: [number, number]) => {
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < coords.length; i++) {
      const d = (coords[i][0] - t[0]) ** 2 + (coords[i][1] - t[1]) ** 2;
      if (d < bestD) { bestD = d; best = i; }
    }
    return best;
  };
  const a = nearest(from);
  const b = to ? nearest(to) : coords.length - 1;
  return coords.slice(Math.min(a, b), Math.max(a, b) + 1);
}

export function formatDuration(s: number): string {
  const total = Math.max(1, Math.round(s / 60));
  if (total < 60) return `${total} min`;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return m ? `${h} hr ${m} min` : `${h} hr`;
}

/** The road the route spends most of its distance on — the "via" line. */
export function viaRoad(steps: RouteStep[]): string | null {
  let best: { road: string; dist: number } | null = null;
  for (const s of steps) {
    // "St." and "Rd." are abbreviations, not the end of the name; "toward" starts a signpost.
    const m = s.instruction.match(/\b(?:onto|on)\s+((?:\b(?:St|Rd|Ave|Dr|Blvd|Mt|Ln|Hwy|Pl|Ct|Sq|Ft)\.|[^.,])+?)(?:\s+towards?\b|\.|,|$)/i);
    if (!m) continue;
    const road = m[1].trim().replace(/\s+/g, ' ').replace(/\.$/, '');
    if (!road || /^the\b/i.test(road)) continue;
    if (!best || s.distance > best.dist) best = { road, dist: s.distance };
  }
  return best?.road ?? null;
}
