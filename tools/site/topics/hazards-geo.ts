// Where each event falls, for tools/site/topics/hazards.ts: inside a country, off its coast, or near a city.
// Countries are public/data/boundaries/countries.json, laid on one-degree grids of polygons and coastline segments.

export type Lnglat = [number, number];

/** At sea, an event counts for every country within SEA_KM, else for the nearest within FAR_SEA_KM. */
export const SEA_KM = 100;
export const FAR_SEA_KM = 300;

export function km([lng1, lat1]: Lnglat, [lng2, lat2]: Lnglat): number {
  const r = Math.PI / 180;
  const a = Math.sin(((lat2 - lat1) * r) / 2) ** 2 + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(((lng2 - lng1) * r) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(Math.min(1, a)));
}

type Polygon = Lnglat[][];
export interface Country { cc: string; id: number; name: string; polygons: { rings: Polygon; box: [number, number, number, number] }[] }

function inRing([x, y]: Lnglat, ring: Lnglat[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export const cellKey = (lng: number, lat: number) => `${((Math.floor(lng) % 360) + 540) % 360 - 180},${Math.floor(lat)}`;

/** Each event's countries: the one it is inside; at sea, every one within SEA_KM, else the nearest within FAR_SEA_KM. */
export class Countries {
  readonly list: Country[] = [];
  private polyGrid = new Map<string, [number, number][]>();
  private segGrid = new Map<string, [number, Lnglat, Lnglat][]>();

  constructor(geojson: { features: { properties: { iso2?: string; name?: string }; geometry: { type: string; coordinates: unknown } }[] }, ids: Map<string, number>) {
    for (const f of geojson.features) {
      const cc = f.properties.iso2;
      // Somaliland, Northern Cyprus and Siachen have no ISO code: a point there counts like one at sea.
      if (!cc || !ids.has(cc)) continue;
      const polys = (f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates) as Polygon[];
      const country: Country = { cc, id: ids.get(cc)!, name: f.properties.name ?? cc, polygons: [] };
      for (const rings of polys) {
        const xs = rings[0].map(p => p[0]), ys = rings[0].map(p => p[1]);
        country.polygons.push({ rings, box: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)] });
      }
      this.list.push(country);
    }
    this.list.forEach((c, ci) => c.polygons.forEach((p, pi) => {
      for (let x = Math.floor(p.box[0]); x <= Math.floor(p.box[2]); x++) for (let y = Math.floor(p.box[1]); y <= Math.floor(p.box[3]); y++) {
        const k = cellKey(x, y);
        (this.polyGrid.get(k) ?? this.polyGrid.set(k, []).get(k)!).push([ci, pi]);
      }
      for (const ring of p.rings) for (let i = 1; i < ring.length; i++) {
        const a = ring[i - 1], b = ring[i];
        for (let x = Math.floor(Math.min(a[0], b[0])); x <= Math.floor(Math.max(a[0], b[0])); x++) for (let y = Math.floor(Math.min(a[1], b[1])); y <= Math.floor(Math.max(a[1], b[1])); y++) {
          const k = cellKey(x, y);
          (this.segGrid.get(k) ?? this.segGrid.set(k, []).get(k)!).push([ci, a, b]);
        }
      }
    }));
  }

  of(p: Lnglat): { hit: Country[]; sea: boolean } {
    const inside = this.inside(p);
    if (inside) return { hit: [inside], sea: false };
    const near = this.coasts(p, FAR_SEA_KM);
    const close = near.filter(([, d]) => d <= SEA_KM);
    return { hit: (close.length ? close : near.slice(0, 1)).map(([c]) => c), sea: true };
  }

  /** A country by the name a source gives it: "SRI LANKA", "MYANMAR (BURMA)", "USA". */
  named(name: string): Country | undefined {
    const key = (s: string) => s.toUpperCase().replace(/\s*\(.*\)$/, '').replace(/[^A-Z]/g, '');
    if (!this.names) {
      this.names = new Map();
      const english = new Intl.DisplayNames(['en'], { type: 'region' });
      for (const c of this.list) for (const n of [c.name, english.of(c.cc) ?? '']) if (n) this.names.set(key(n), c);
      this.names.set('USA', this.list.find(c => c.cc === 'US')!);
    }
    return this.names.get(key(name));
  }

  private names?: Map<string, Country>;

  /** The one country a point on a coast belongs to, as a tsunami's runup does: the one it is in, else the nearest within SEA_KM. */
  at(p: Lnglat): Country | undefined {
    const inside = this.inside(p);
    if (inside) return inside;
    const [nearest] = this.coasts(p, SEA_KM);
    return nearest?.[0];
  }

  private inside(p: Lnglat): Country | undefined {
    for (const [ci, pi] of this.polyGrid.get(cellKey(p[0], p[1])) ?? []) {
      const { rings, box } = this.list[ci].polygons[pi];
      if (p[0] < box[0] || p[0] > box[2] || p[1] < box[1] || p[1] > box[3]) continue;
      if (inRing(p, rings[0]) && !rings.slice(1).some(h => inRing(p, h))) return this.list[ci];
    }
    return undefined;
  }

  /** Countries whose coast is within `maxKm`, nearest first. */
  private coasts(p: Lnglat, maxKm: number): [Country, number][] {
    const cos = Math.max(0.05, Math.cos((p[1] * Math.PI) / 180));
    const dy = Math.ceil(maxKm / 110.57), dx = Math.min(180, Math.ceil(maxKm / (111.32 * cos)));
    const near = new Map<number, number>();
    const seen = new Set<string>();
    for (let x = -dx; x <= dx; x++) for (let y = -dy; y <= dy; y++) {
      const k = cellKey(p[0] + x, p[1] + y);
      if (seen.has(k)) continue;
      seen.add(k);
      for (const [ci, a, b] of this.segGrid.get(k) ?? []) {
        const d = segmentKm(p, a, b, cos);
        if (d <= maxKm && d < (near.get(ci) ?? Infinity)) near.set(ci, d);
      }
    }
    return [...near].sort((a, b) => a[1] - b[1]).map(([ci, d]) => [this.list[ci], d]);
  }
}

/** The box around all of a country's parts, [w, s, e, n]; across the antimeridian when that leaves the widest gap. */
export function countryBox(boxes: [number, number, number, number][]): [number, number, number, number] {
  const spans = boxes.map(b => [b[0], b[2]]).sort((a, b) => a[0] - b[0]);
  const merged: number[][] = [];
  for (const [w, e] of spans) {
    const last = merged[merged.length - 1];
    if (last && w <= last[1]) last[1] = Math.max(last[1], e); else merged.push([w, e]);
  }
  // The widest stretch of longitude with none of the country in it, going round the back.
  let gap = merged[0][0] + 360 - merged[merged.length - 1][1], after = 0;
  for (let i = 1; i < merged.length; i++) if (merged[i][0] - merged[i - 1][1] > gap) { gap = merged[i][0] - merged[i - 1][1]; after = i; }
  const r = (v: number) => Math.round(v * 100) / 100;
  return [r(merged[after][0]), r(Math.min(...boxes.map(b => b[1]))), r(merged[(after + merged.length - 1) % merged.length][1]), r(Math.max(...boxes.map(b => b[3])))];
}

/** Distance from p to the segment ab, on a plane laid flat at p. */
export function segmentKm(p: Lnglat, a: Lnglat, b: Lnglat, cos: number): number {
  const wrap = (d: number) => (d > 180 ? d - 360 : d < -180 ? d + 360 : d);
  const ax = wrap(a[0] - p[0]) * 111.32 * cos, ay = (a[1] - p[1]) * 110.57;
  const bx = wrap(b[0] - p[0]) * 111.32 * cos, by = (b[1] - p[1]) * 110.57;
  const vx = bx - ax, vy = by - ay;
  const len = vx * vx + vy * vy;
  const s = len ? Math.max(0, Math.min(1, -(ax * vx + ay * vy) / len)) : 0;
  return Math.hypot(ax + s * vx, ay + s * vy);
}

/** Events within `radius` of each point, or `far` for those `big` picks, through a one-degree grid. */
export function nearby<T extends { at: Lnglat | null }>(events: T[], radius: number, far: number, big: (e: T) => boolean) {
  const grid = new Map<string, T[]>();
  for (const e of events) if (e.at) (grid.get(cellKey(e.at[0], e.at[1])) ?? grid.set(cellKey(e.at[0], e.at[1]), []).get(cellKey(e.at[0], e.at[1]))!).push(e);
  return (p: Lnglat): T[] => {
    const dy = Math.ceil(far / 110.57), dx = Math.ceil(far / (111.32 * Math.max(0.05, Math.cos((p[1] * Math.PI) / 180))));
    const out: T[] = [];
    for (let x = -dx; x <= dx; x++) for (let y = -dy; y <= dy; y++) for (const e of grid.get(cellKey(p[0] + x, p[1] + y)) ?? []) {
      const d = km(p, e.at!);
      if (d <= radius || (d <= far && big(e))) out.push(e);
    }
    return out;
  };
}
