/**
 * The country pairs worth a comparison page in search, data/site/compare-pairs.json (tools/site/compare-pairs.ts).
 * Any other pair still renders when asked for, unindexed.
 */

/** Why a pair is listed: they share a land border, both are among the biggest countries, or both are big in one region. */
export type PairReason = 'border' | 'major' | 'region';

/** The World Bank's regions, all income levels. */
export type WorldRegion = 'eca' | 'ssa' | 'lac' | 'eap' | 'mena' | 'sas' | 'nam';

export interface ComparePairsFile {
  generated: string;
  /** Each country's region, by ISO2. */
  regions: Record<string, WorldRegion>;
  /** GeoNames ids, the lower first, and why. */
  pairs: [a: number, b: number, why: PairReason[]][];
}
