import type { RtVehicle } from '../gtfs/realtime';

/**
 * Chicago's 'L' from the CTA Train Tracker map on transitchicago.com: every train with a GPS fix, its run
 * number and next stations, keyless, ~25 KB a call. Undocumented and outside the developer licence, which
 * covers its keyed API (lapi.transitchicago.com ttpositions, the same trains); swap to that given a key.
 * Line codes: T is Brown, V Pink, O Orange.
 */
export const CTA_URL = 'https://www.transitchicago.com/traintracker/PredictionMap/tmTrains.aspx?line=R,B,G,T,P,Y,V,O&MaxPredictions=1';

const LINE_NAMES: Record<string, string> = { Red: 'Red', Blu: 'Blue', Grn: 'Green', Brn: 'Brown', Pur: 'Purple', Yel: 'Yellow', Pnk: 'Pink', Org: 'Orange' };

interface Marker {
  Position?: { Lat?: number; Lng?: number };
  RunNumber?: string;
  /** Radians anticlockwise from east. */
  Direction?: number;
  LineName?: string;
  DestName?: string;
  Predictions?: [number, string, string, string][];
}

/** Throws on anything but the map's `{ status: 'OK', dataObject: [{ Line, Markers }] }`. */
export function parseCta(text: string): RtVehicle[] {
  const body = JSON.parse(text) as { status?: string; dataObject?: { Line?: string; Markers?: Marker[] }[] };
  if (body.status !== 'OK' || !Array.isArray(body.dataObject)) throw new Error(`CTA: status ${body.status}`);
  const out: RtVehicle[] = [];
  for (const line of body.dataObject) {
    for (const m of line.Markers ?? []) {
      const lat = m.Position?.Lat, lng = m.Position?.Lng;
      if (!m.RunNumber || lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng) || (!lat && !lng)) continue;
      const deg = m.Direction != null && Number.isFinite(m.Direction) ? (m.Direction * 180) / Math.PI : null;
      const next = m.Predictions?.[0]?.[1];
      out.push({
        // Run numbers repeat across lines.
        id: `${line.Line}${m.RunNumber}`, lat, lng, label: m.RunNumber,
        route: LINE_NAMES[m.LineName ?? ''] ?? m.LineName, mode: 'metro',
        bearing: deg == null ? undefined : Math.round((((90 - deg) % 360) + 360) % 360),
        stop: next, status: next ? 2 : undefined,
      });
    }
  }
  return out;
}
