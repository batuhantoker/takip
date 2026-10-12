/**
 * "Private Jets" → "Private jets", "NET & EVENT INTEL" → "Net & event intel".
 * Mixed-case text keeps acronyms (GPS, CCTV, 3D) and only lowers later capitalised words.
 */
export function sentenceCase(text: string): string {
  if (!/[a-z]/.test(text)) return text.charAt(0) + text.slice(1).toLowerCase();
  return text.replace(/\b[A-Z][a-z]+\b/g, (word, at: number) => (at === 0 ? word : word.toLowerCase()));
}
