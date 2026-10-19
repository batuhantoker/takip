import type { Place } from './place';

/**
 * US states, counties and towns as places, from the Census Bureau's boundaries and estimates (the us-counties and
 * us-places layers in data/db), written to data/site/us-areas.json by tools/site/build-us-areas.ts and merged into
 * the gazetteer. A town is an incorporated place the GeoNames list of cities leaves out, mostly under 15,000 people.
 * Their ids come from Census FIPS codes, past GeoNames' range: GeoNames still lists Connecticut's old counties,
 * which the Census replaced with planning regions in 2022.
 */
const BASE = 900_000_000;
const TOWN_BASE = 800_000_000;

/** "13" (Georgia) → 900013000. */
export const statePlaceId = (fips: string) => BASE + Number(fips) * 1000;
/** "13121" (Fulton County) → 900013121; county codes start at 001, so none meets its state's. */
export const countyPlaceId = (geoid: string) => BASE + Number(geoid);
/** "4872392" (West University Place, Texas) → 804872392; place GEOIDs stop below 7,900,000. */
export const townPlaceId = (geoid: string) => TOWN_BASE + Number(geoid);
export const townGeoid = (id: number) => String(id - TOWN_BASE).padStart(7, '0');

export interface UsAreasFile {
  generated: string;
  /** States, counties and towns. */
  places: Place[];
  /** The places a gazetteer city lies within, by its id: [state, county]. */
  parents: Record<string, number[]>;
  /** The Census place that is a gazetteer city, by the city's id: its GEOID, and whether it is a CDP rather than incorporated. */
  limits: Record<string, { geoid: string; cdp?: true }>;
}
