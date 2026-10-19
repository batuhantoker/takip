/**
 * The natural-hazards table, data/site/topics/hazards.json (tools/site/topics/hazards.ts), keyed by GeoNames id.
 * Two sources, never summed into one number: USGS ComCat's earthquake catalogue, and NOAA NCEI's lists of
 * significant earthquakes, tsunamis and eruptions as TAKIP's History imported them.
 */

/** The last ten calendar years, the last hundred, and everything each source holds. */
export type HazardRangeId = '10y' | '100y' | 'all';
export const HAZARD_RANGES: readonly HazardRangeId[] = ['10y', '100y', 'all'];

/** A quake, a tsunami or an eruption. */
export type HazardKind = 'q' | 't' | 'v';

export interface HazardEvent {
  k: HazardKind;
  /** UTC, to the precision the source gives: '2023-02-06', '1939-12', '1268', '-1449' (astronomical: 1450 BCE). */
  d: string;
  /** A quake's magnitude (USGS's where both list it), a tsunami's source quake's, an eruption's VEI. */
  m?: number;
  /** NOAA's total for a quake or an eruption, wherever they died. Never a tsunami's: NOAA's includes its source quake's. */
  deaths?: number;
  /** A tsunami's highest water, in metres. */
  h?: number;
  /** [lon, lat] of the epicentre, the volcano, or where the tsunami began. */
  at: [number, number];
  /** Where, in the source's own English: USGS's "26 km SW of Hakkâri, Turkey", NOAA's "Duzce", a volcano's name. */
  where?: string;
  /** The English Wikipedia title, or "fr:Titre" (attrs.wiki at import). */
  wiki?: string;
  /** NCEI's event id, for its page. The event's key is USGS ComCat's id wherever USGS lists the quake, else NOAA's "eq:10924". */
  n?: number;
}

export interface HazardWave { id: string; deaths?: number; h?: number; away?: true }

export interface HazardRange {
  /** First and last year counted: for 'all', the year of the oldest NOAA event here. */
  from: number;
  to: number;
  /** USGS ComCat earthquakes of at least the range's floor (HazardMeta.floors). */
  usgs: number;
  m6: number;
  m7: number;
  /** The USGS count per year (10y) or per ten years from `from` (100y). */
  by?: number[];
  /** NOAA significant earthquakes, and those of them not in this range's USGS count. */
  quakes: number;
  quakesUnmatched: number;
  /**
   * NOAA tsunamis that began here or reached here (a runup with deaths or a metre of water), of them those from
   * elsewhere, and those not caused by a quake or eruption already counted here.
   */
  tsunamis: number;
  tsunamisFrom: number;
  tsunamisUnlinked: number;
  /** The listed tsunamis' runups here: the dead they record, the highest water, and `away` for one that began elsewhere. */
  waves?: HazardWave[];
  eruptions: number;
  volcanoes: number;
  /** Deaths NOAA records for these events (each event's whole toll), and how many events had any. */
  deaths: number;
  deadly: number;
  /** How many quakes share the top magnitude, when more than one does. */
  ties?: number;
  /** Event ids in HazardMeta.events: the strongest, the deadliest, the latest, the oldest (all), the largest tsunamis and eruptions. */
  top: string[];
  /** The busiest year or ten years' strongest quake, and how many of the count followed it within 30 days and 150 km. */
  peak?: { id: string; after: number };
}

export type HazardRow = Partial<Record<HazardRangeId, HazardRange>> & {
  /** A country's box [w, s, e, n], for its map; west above east crosses the antimeridian. */
  box?: [number, number, number, number];
  /** A country none of whose events counted at sea: "in Switzerland", not "in or off". */
  inland?: true;
};

export interface HazardMeta {
  /** The day counted to; the ranges are whole calendar years up to it. */
  asOf: string;
  floors: Record<HazardRangeId, number>;
  /** The first year USGS is counted in the whole-record range. */
  usgsSince: number;
  /** How far a city's count reaches, and further for a quake of `bigMag` and up; at sea, how far an epicentre counts for every country near, and for the nearest. */
  cityKm: number;
  cityBigKm: number;
  bigMag: number;
  seaKm: number;
  farSeaKm: number;
  events: Record<string, HazardEvent>;
}
