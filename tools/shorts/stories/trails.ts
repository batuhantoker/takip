/**
 * Famous hiking trails for the hiking tour: a stretch of each to pan along, and the route its card will name where the
 * pan ends. The map's trails are a raster, so a card opens by asking Waymarked Trails what runs under a click
 * (components/map/layers/reference/hiking-pick.ts); the same question asked here names the card before filming.
 */
import { drawnAt, routeGeometry, routesAt } from '../../../src/lib/feeds/hiking/api';
import { WMT_API } from '../../../src/lib/feeds/hiking/overlay';
import { mercatorBox, type MercatorBox } from '../../../src/lib/feeds/hiking/mercator';

/** The trails a tour visits: OpenStreetMap relation ids on Waymarked Trails, framed close enough to read the route. */
export const TRAILS = [
  { label: 'The Alps', relation: 124456 },
  { label: 'The Pyrenees', relation: 7411272 },
  // the West Highland Way runs under the Eastern Continental Trail all the way, so a click never names it
  { label: 'Lapland', relation: 1657661 },
];
export const TRAIL_ZOOM = 11;
/** How far back along the trail the pan starts, in degrees. */
const PAN_DEG = 0.05;
/** The map's click looks this many pixels around the point (hiking-pick.ts HIT_PX). */
const HIT_PX = 8;

export interface TrailSpot { label: string; name: string; itinerary: string[]; a: [number, number]; b: [number, number] }

/** A box of `px` pixels around a point at a zoom, in MapLibre's 512 px tiles, as the click asks. */
function around([lon, lat]: [number, number], zoom: number, px: number): MercatorBox {
  const deg = (px * 360) / (512 * 2 ** zoom);
  return mercatorBox(lon - deg, lat - deg * Math.cos((lat * Math.PI) / 180), lon + deg, lat + deg * Math.cos((lat * Math.PI) / 180));
}

/** Where along a line to try ending the pan, middle first. */
const TRIES = [0.5, 0.42, 0.58, 0.34, 0.66, 0.26, 0.74, 0.18, 0.82];

/**
 * Each trail's longest mapped line, a stretch of it ending where a click names the trail itself (shared stretches name
 * whichever route ranks higher, the Eastern Continental Trail over the West Highland Way), and that card's route.
 */
export async function trailSpots(): Promise<TrailSpot[]> {
  const out: TrailSpot[] = [];
  for (const t of TRAILS) {
    const details = await fetch(`${WMT_API}/details/relation/${t.relation}`).then(r => (r.ok ? r.json() : null)) as { bbox?: number[] } | null;
    if (!details?.bbox || details.bbox.length !== 4) continue;
    const lines = (await routeGeometry(t.relation, details.bbox as MercatorBox)).features
      .flatMap(f => (f.geometry.type === 'LineString' ? [f.geometry.coordinates] : f.geometry.type === 'MultiLineString' ? f.geometry.coordinates : [])) as number[][][];
    const line = lines.sort((x, y) => y.length - x.length)[0];
    if (!line || line.length < 20) continue;
    for (const at of TRIES) {
      const b = line[Math.floor(line.length * at)] as [number, number];
      const shown = (await routesAt(around(b, TRAIL_ZOOM, HIT_PX))).filter(r => drawnAt(r.group, TRAIL_ZOOM));
      if (shown[0]?.id !== t.relation) continue;
      // about 5 km back along the line: a pan the eye can follow at the trail's zoom
      const end = Math.floor(line.length * at);
      let from = end;
      while (from > 0 && Math.hypot(line[from][0] - b[0], line[from][1] - b[1]) < PAN_DEG) from--;
      const a = line[from] as [number, number];
      out.push({ label: t.label, name: shown[0].name ?? shown[0].ref ?? 'a waymarked trail', itinerary: shown[0].itinerary ?? [], a, b });
      break;
    }
  }
  return out;
}
