/*
 * Deep time: ages in millions of years before today (Ma). The History clock for it counts years from
 * today, negative into the past, so it plays forward toward now like the calendar one.
 */

export const YEARS_PER_MA = 1_000_000;
export const maAt = (t: number) => Math.max(0, -t / YEARS_PER_MA);
export const atMa = (ma: number) => -ma * YEARS_PER_MA;

/** Base of each period in Ma, youngest first, with the ICS chart colour. Phanerozoic ages as in PhanDA (GTS 2020). */
export const PERIODS = [
  { name: 'Quaternary', era: 'Cenozoic', base: 2.58, color: '#F9F97F' },
  { name: 'Neogene', era: 'Cenozoic', base: 23.04, color: '#FFE619' },
  { name: 'Paleogene', era: 'Cenozoic', base: 66, color: '#FD9A52' },
  { name: 'Cretaceous', era: 'Mesozoic', base: 143.1, color: '#7FC64E' },
  { name: 'Jurassic', era: 'Mesozoic', base: 201.36, color: '#34B2C9' },
  { name: 'Triassic', era: 'Mesozoic', base: 251.9, color: '#812B92' },
  { name: 'Permian', era: 'Paleozoic', base: 298.89, color: '#F04028' },
  { name: 'Carboniferous', era: 'Paleozoic', base: 359.3, color: '#67A599' },
  { name: 'Devonian', era: 'Paleozoic', base: 419, color: '#CB8C37' },
  { name: 'Silurian', era: 'Paleozoic', base: 443.07, color: '#B3E1B6' },
  { name: 'Ordovician', era: 'Paleozoic', base: 486.85, color: '#009270' },
  { name: 'Cambrian', era: 'Paleozoic', base: 538.8, color: '#7FA056' },
  { name: 'Ediacaran', era: 'Neoproterozoic', base: 635, color: '#FED96A' },
  { name: 'Cryogenian', era: 'Neoproterozoic', base: 720, color: '#FECC5C' },
  { name: 'Tonian', era: 'Neoproterozoic', base: 1000, color: '#FEBF4E' },
  { name: 'Stenian', era: 'Mesoproterozoic', base: 1200, color: '#FED99A' },
  { name: 'Ectasian', era: 'Mesoproterozoic', base: 1400, color: '#F3CC8A' },
  { name: 'Calymmian', era: 'Mesoproterozoic', base: 1600, color: '#FDC07A' },
  { name: 'Statherian', era: 'Paleoproterozoic', base: 1800, color: '#F875A7' },
] as const;

export type Period = (typeof PERIODS)[number];

export function periodAt(ma: number): Period {
  return PERIODS.find(p => ma <= p.base) ?? PERIODS[PERIODS.length - 1];
}

const group = (n: number, digits: number) => n.toLocaleString('en', { minimumFractionDigits: digits, maximumFractionDigits: digits });

/** "250.0 Ma", "66.04 Ma", "120 ka": as many decimals as the motion at that age shows. */
export function formatMa(ma: number) {
  if (ma < 1) return `${Math.round(ma * 1000)} ka`;
  return `${group(ma, ma < 100 ? 2 : 1)} Ma`;
}

/** "250 million years ago", "1.2 billion years ago", "today". */
export function longMa(ma: number) {
  if (ma < 0.001) return 'today';
  if (ma < 1) return `${group(Math.round(ma * 1000), 0)} thousand years ago`;
  if (ma >= 1000) return `${group(ma / 1000, ma % 100 ? 2 : 1)} billion years ago`;
  return `${group(ma, ma < 10 ? 1 : 0)} million years ago`;
}

/**
 * "250 Ma", "250 mya", "250 million years ago", "1.2 Ga", "1.2 billion years ago", "20 ka", "Jurassic"
 * (its start) → Ma, or undefined when the text isn't a deep-time age.
 */
export function parseDeepJump(text: string): number | undefined {
  const s = text.trim().toLowerCase().replace(/,/g, '');
  const period = PERIODS.find(p => p.name.toLowerCase() === s);
  if (period) return period.base;
  const m = /^(\d+(?:\.\d+)?)\s*(ma|mya|myr|my|m|million years(?: ago)?|ga|bya|gyr|billion years(?: ago)?|ka|kya|kyr|thousand years(?: ago)?)$/.exec(s);
  if (!m) return undefined;
  const n = Number(m[1]);
  const unit = m[2];
  if (/^(ga|bya|gyr|billion)/.test(unit)) return n * 1000;
  if (/^(ka|kya|kyr|thousand)/.test(unit)) return n / 1000;
  return n;
}

const SUN_AGE_GYR = 4.57;

/** The Sun's brightness then as a share of today's, from the standard solar model fit of Gough (1981). */
export function sunBrightness(ma: number) {
  return 1 / (1 + 0.4 * (ma / 1000 / SUN_AGE_GYR));
}
