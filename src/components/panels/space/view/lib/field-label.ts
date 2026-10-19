const KEEP: Record<string, string> = {
  ra: 'RA', dec: 'Dec', cospar: 'COSPAR', id: 'ID', jpl: 'JPL', sbdb: 'SBDB', simbad: 'SIMBAD', nasa: 'NASA', au: 'AU',
  earth: 'Earth', sun: 'Sun', moon: 'Moon', mars: 'Mars', horizons: 'Horizons', exoplanet: 'Exoplanet', archive: 'Archive',
};

/** "FROM EARTH" → "From Earth", "RA / DEC" → "RA / Dec": the cards' labels arrive in capitals. */
export function fieldLabel(text: string): string {
  if (text !== text.toUpperCase()) return text;
  const words = text.toLowerCase().replace(/\b[a-z]+\b/g, w => KEEP[w] ?? w);
  return words.charAt(0).toUpperCase() + words.slice(1);
}
