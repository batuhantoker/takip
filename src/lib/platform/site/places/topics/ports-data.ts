import type { MajorPortType } from '@/lib/feeds/maritime/ports';

/**
 * The ports near each place, from NGA's World Port Index (Pub. 150) and the maritime layer's own lists of major
 * ports and chokepoints. tools/site/topics/ports.ts writes data/site/topics/ports.json: the harbours once, in
 * `meta.ports`, and per place only which of them lie within PORT_KM and how far.
 */

/** The Index rates a harbour by its area, facilities and wharf space when NGA last surveyed it, not by its traffic. */
export type HarbourSize = 'large' | 'medium' | 'small' | 'very-small';
export type HarbourType = 'coastal' | 'breakwater' | 'tide-gates' | 'river' | 'river-basins' | 'river-tide-gates' | 'canal-lake' | 'roadstead' | 'typhoon';
/** The Index leaves most harbours' use Unknown; only these four are ever given. */
export type HarbourUse = 'cargo' | 'fishing' | 'ferry' | 'military';
/** Facilities the Index marks Yes. It leaves most Unknown, which is not the same as No. */
export type PortFacility = 'container' | 'roro' | 'dry-bulk' | 'liquid-bulk' | 'oil' | 'lng' | 'breakbulk' | 'repairs' | 'dry-dock';
export type MapPortType = MajorPortType;

/** How far from a place a harbour counts as its own. */
export const PORT_KM = 10;
/** A major port's coordinates in the maritime route are rough, so they reach further. */
export const MAP_PORT_KM = 25;
/** The radius the maritime route counts a chokepoint's ships in. */
export const CHOKEPOINT_KM = 100;

const LETTERS: Record<string, string> = { ø: 'o', æ: 'ae', œ: 'oe', ß: 'ss', ł: 'l', đ: 'd', ð: 'd', þ: 'th', ı: 'i' };

/** A name for comparing, so the Index's "Helsingor" is Helsingør and "Bur Sa'id" is "bur sa id". */
export const foldName = (s: string) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[øæœßłđðþı]/g, c => LETTERS[c]).replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

const SIZES = { L: 'large', M: 'medium', S: 'small', V: 'very-small' } as const satisfies Record<string, HarbourSize>;
export type SizeCode = keyof typeof SIZES;

/** One harbour in meta.ports, keyed by its World Port Index number. Keys are short: the table holds thousands. */
export interface PortRow {
  /** Name, as the Index spells it. */
  n: string;
  s?: SizeCode;
  t?: HarbourType;
  u?: HarbourUse;
  f?: PortFacility[];
  /** Entrance channel depth in metres, the lower bound of the Index's depth band. */
  d?: number;
  /** Longest ship it takes, in metres. */
  l?: number;
  /** Ice can restrict the entrance. */
  i?: 1;
  /** A vessel traffic service watches the approaches. */
  v?: 1;
  /** [lon, lat] */
  at: [number, number];
  /** The GeoNames id of the place it is credited to, so one harbour leads one indexed page. */
  h: number;
  /** Different ships the archive heard within PORT_KM over meta.ais's sample; absent when no archive was read. */
  a?: number;
}

/** One of the maritime route's major ports, as the map marks it. */
export interface MapPortRow {
  n: string;
  t: MapPortType;
  /** The route's reference figure, '14.5M TEU' or '6.5M bpd'. */
  v?: string;
  r?: number;
  /** The fleet a naval base is home to. */
  f?: string;
  at: [number, number];
  h: number;
  /** As PortRow's, around the route's coordinates for it. */
  a?: number;
}

/** One place's row: [WPI number, km] nearest first, and the nearest major port and chokepoint as [index, km]. */
export interface PortsRow {
  p: [number, number][];
  m?: [number, number];
  c?: [number, number];
}

export interface AisSample {
  /** Archived hours read, spread over the day before `to`. */
  hours: number;
  /** ISO times the sample spans. */
  from: string;
  to: string;
}

export interface PortsMeta {
  /** The day the World Port Index was downloaded. */
  wpi: string;
  ais?: AisSample;
  ports: Record<string, PortRow>;
  map: MapPortRow[];
  chokepoints: { n: string; at: [number, number] }[];
}

export interface NearPort {
  wpi: number;
  name: string;
  km: number;
  size?: HarbourSize;
  type?: HarbourType;
  use?: HarbourUse;
  facilities: PortFacility[];
  channelM?: number;
  maxLengthM?: number;
  ice: boolean;
  vts: boolean;
  at: [number, number];
  /** GeoNames id of the place this harbour is credited to. */
  home: number;
  heard?: number;
}

export interface MapPort {
  name: string;
  type: MapPortType;
  volume?: string;
  rank?: number;
  fleet?: string;
  km: number;
  at: [number, number];
  home: number;
  heard?: number;
}

/** Everything one place's port pages can say, read back from the table. */
export interface PlacePorts {
  id: number;
  ports: NearPort[];
  major?: MapPort;
  chokepoint?: { name: string; km: number };
  ais?: AisSample;
  /** The day the Index was downloaded. */
  wpi: string;
}

export function placePorts(id: number, row: PortsRow, meta: PortsMeta): PlacePorts {
  const ports = row.p.flatMap(([wpi, km]): NearPort[] => {
    const p = meta.ports[wpi];
    if (!p) return [];
    return [{
      wpi, name: p.n, km, size: p.s && SIZES[p.s], type: p.t, use: p.u, facilities: p.f ?? [],
      channelM: p.d, maxLengthM: p.l, ice: p.i === 1, vts: p.v === 1, at: p.at, home: p.h, heard: p.a,
    }];
  });
  const m = row.m && meta.map[row.m[0]];
  const c = row.c && meta.chokepoints[row.c[0]];
  return {
    id,
    ports,
    major: m ? { name: m.n, type: m.t, volume: m.v, rank: m.r, fleet: m.f, km: row.m![1], at: m.at, home: m.h, heard: m.a } : undefined,
    chokepoint: c ? { name: c.n, km: row.c![1] } : undefined,
    ais: meta.ais,
    wpi: meta.wpi,
  };
}
