/* Vessel categories, shared by the live maritime route and the replay seal jobs. */

export type ShipCategory = 'cargo' | 'tanker' | 'passenger' | 'fishing' | 'military' | 'service' | 'leisure' | 'other';

/** Buckets an AIS ship-type code (ITU-R M.1371, 0–99). */
export function shipCategory(typeCode?: number): ShipCategory {
  if (typeCode === undefined) return 'other';
  if (typeCode === 30) return 'fishing';
  if (typeCode === 35 || typeCode === 55) return 'military'; // 55 = law enforcement
  if (typeCode === 36 || typeCode === 37) return 'leisure';
  if ((typeCode >= 31 && typeCode <= 34) || (typeCode >= 50 && typeCode <= 58)) return 'service';
  if (typeCode >= 40 && typeCode <= 49) return 'passenger'; // high-speed craft, mostly ferries
  if (typeCode >= 60 && typeCode <= 69) return 'passenger';
  if (typeCode >= 70 && typeCode <= 79) return 'cargo';
  if (typeCode >= 80 && typeCode <= 89) return 'tanker';
  return 'other';
}
