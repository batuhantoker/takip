import { areaParts, bboxOf, pointInParts, type AreaGeometry } from '@/lib/places/areas/aoi';

/** West, south, east, north in degrees. */
export type Bbox = [number, number, number, number];

/** Where a satellite-image search looks: a box, or a drawn shape searched by its box. */
export interface ImageryArea {
  center: { lat: number; lng: number };
  bbox: Bbox;
  widthKm: number;
  heightKm: number;
  /** A drawn shape inside the box; coverage only counts ground inside it. */
  shape?: AreaGeometry;
  /** Set when the area asked for was wider than one search, and this is its middle. */
  clamped?: boolean;
}

/** A side longer than this would ask Planetary Computer for thousands of tiles. */
export const MAX_AREA_KM = 500;

const KM_PER_DEG = 111.32;
const RAD = Math.PI / 180;

const clampLat = (v: number) => Math.max(-85, Math.min(85, v));
const clampLng = (v: number) => Math.max(-180, Math.min(180, v));
const wrapLng = (v: number) => ((((v + 180) % 360) + 360) % 360) - 180;

/** Width and height in km, measured across the middle. */
export function bboxSize([w, s, e, n]: Bbox): { widthKm: number; heightKm: number } {
  return { widthKm: (e - w) * KM_PER_DEG * Math.cos(((s + n) / 2) * RAD), heightKm: (n - s) * KM_PER_DEG };
}

function boxAround(lat: number, lng: number, widthKm: number, heightKm: number): Bbox {
  const dLat = heightKm / 2 / KM_PER_DEG;
  const dLng = widthKm / 2 / (KM_PER_DEG * Math.max(0.05, Math.cos(lat * RAD)));
  return [clampLng(lng - dLng), clampLat(lat - dLat), clampLng(lng + dLng), clampLat(lat + dLat)];
}

function make(bbox: Bbox, extra: Partial<ImageryArea> = {}): ImageryArea {
  return { center: { lat: (bbox[1] + bbox[3]) / 2, lng: (bbox[0] + bbox[2]) / 2 }, bbox, ...bboxSize(bbox), ...extra };
}

/** A square `sizeKm` across around a point. */
export function areaAround(lat: number, lng: number, sizeKm: number): ImageryArea {
  const side = Math.min(sizeKm, MAX_AREA_KM);
  return make(boxAround(lat, lng, side, side));
}

/** A box such as the map view, cut to its middle MAX_AREA_KM when it is wider. */
export function areaOfBox([w, s, e, n]: Bbox): ImageryArea {
  const { widthKm, heightKm } = bboxSize([w, s, e, n]);
  const clamped = widthKm > MAX_AREA_KM || heightKm > MAX_AREA_KM;
  if (!clamped && w >= -180 && e <= 180) return make([w, s, e, n]);
  // The map's bounds run past ±180 when the world wraps.
  const lng = wrapLng((w + e) / 2);
  const lat = (s + n) / 2;
  const box = boxAround(lat, lng, Math.min(widthKm, MAX_AREA_KM), Math.min(heightKm, MAX_AREA_KM));
  return make(box, clamped ? { clamped } : {});
}

/** A drawn shape: searched by its box, or by the middle of it when it is too big for one search. */
export function areaOfShape(shape: AreaGeometry): ImageryArea {
  const parts = areaParts(shape);
  const box = bboxOf(parts.flatMap(p => p.outer));
  const area = areaOfBox([box.west, box.south, box.east, box.north]);
  return { ...area, shape };
}

/** What the STAC search intersects. */
export function searchPolygon({ bbox: [w, s, e, n] }: ImageryArea): GeoJSON.Polygon {
  return { type: 'Polygon', coordinates: [[[w, s], [e, s], [e, n], [w, n], [w, s]]] };
}

/** The outline drawn on the map while the window is open. */
export const areaOutline = (area: ImageryArea): AreaGeometry => area.shape ?? searchPolygon(area);

/** A grid of points over the area's ground, to measure how much of it a set of footprints covers. */
export function samplePoints(area: ImageryArea, n = 16): [number, number][] {
  const [w, s, e, nn] = area.bbox;
  const parts = area.shape ? areaParts(area.shape) : null;
  const out: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const lng = w + ((i + 0.5) / n) * (e - w);
      const lat = s + ((j + 0.5) / n) * (nn - s);
      if (!parts || pointInParts(lng, lat, parts)) out.push([lng, lat]);
    }
  }
  // A thin shape can slip between the grid lines.
  return out.length ? out : [[area.center.lng, area.center.lat]];
}

/** Which of the samples lie inside a footprint. */
export function samplesIn(footprint: GeoJSON.Geometry | null, samples: [number, number][]): number[] {
  if (!footprint || (footprint.type !== 'Polygon' && footprint.type !== 'MultiPolygon')) return [];
  const parts = areaParts(footprint);
  return samples.flatMap(([lng, lat], i) => (pointInParts(lng, lat, parts) ? [i] : []));
}

/** "40 × 25 km" */
export function areaLabel(area: ImageryArea): string {
  const r = (km: number) => (km >= 10 ? Math.round(km) : Math.round(km * 10) / 10);
  return `${r(area.widthKm)} × ${r(area.heightKm)} km`;
}

