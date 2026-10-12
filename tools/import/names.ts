/** core_entity_name.norm: lower case, no diacritics, punctuation collapsed to single spaces. */
export function normName(s: string) {
  return s
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}
