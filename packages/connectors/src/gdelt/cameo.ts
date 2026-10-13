/** TAKIP — CAMEO root codes, the 20 verbs GDELT codes every event with. */

export type GdeltFamily = 'violence' | 'protest' | 'tension' | 'cooperation';

export const GDELT_FAMILIES: readonly GdeltFamily[] = ['violence', 'protest', 'tension', 'cooperation'];

/** 01–09 talk and help, 10–13 and 15–17 pressure, 14 protest, 18–20 force. */
export function familyOf(rootCode: string): GdeltFamily {
  const r = Number(rootCode);
  if (r >= 18) return 'violence';
  if (r === 14) return 'protest';
  if (r >= 10) return 'tension';
  return 'cooperation';
}

export const CAMEO_ROOTS: Record<string, string> = {
  '01': 'Made a statement',
  '02': 'Appealed',
  '03': 'Offered to cooperate',
  '04': 'Consulted',
  '05': 'Diplomatic cooperation',
  '06': 'Material cooperation',
  '07': 'Provided aid',
  '08': 'Yielded',
  '09': 'Investigated',
  '10': 'Demanded',
  '11': 'Disapproved',
  '12': 'Rejected',
  '13': 'Threatened',
  '14': 'Protested',
  '15': 'Showed force',
  '16': 'Cut relations',
  '17': 'Coerced',
  '18': 'Assaulted',
  '19': 'Fought',
  '20': 'Mass violence',
};
