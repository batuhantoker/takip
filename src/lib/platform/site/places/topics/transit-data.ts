import type { TransitMode } from '@/lib/feeds/transit/modes';

/**
 * How an operator's vehicles get onto the map, as the transit layer labels them: GPS positions, positions worked
 * out from arrival predictions, a mix of the two, or the timetable where nothing live exists.
 */
export type OperatorHow = 'live' | 'estimated' | 'partly' | 'timetable';

export interface TransitOperator { name: string; how: OperatorHow; modes: TransitMode[]; license?: string }

/** One place's row in data/site/topics/transit.json (tools/site/topics/transit.ts). */
export interface TransitRow {
  /** Vehicles seen there when the transit catalogue was probed; 0 where the probe fell at night. */
  vehicles: number;
  modes: TransitMode[];
  operators: TransitOperator[];
}

/** The day the transit catalogue was probed. */
export interface TransitMeta { seen: string }
