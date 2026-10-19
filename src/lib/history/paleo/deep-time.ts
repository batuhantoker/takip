import { DEFAULT_LOCALE } from '@/lib/core/i18n/locales';
import { createTranslator, msg, type Translate } from '@/lib/core/i18n/translator';

/*
 * Deep time: ages in millions of years before today (Ma). The History clock for it counts years from
 * today, negative into the past, so it plays forward toward now like the calendar one.
 */

export const YEARS_PER_MA = 1_000_000;
export const maAt = (t: number) => Math.max(0, -t / YEARS_PER_MA);
export const atMa = (ma: number) => -ma * YEARS_PER_MA;

/** Base of each period in Ma, youngest first, with the ICS chart colour. Phanerozoic ages as in PhanDA (GTS 2020). */
export const PERIODS = [
  { name: msg('Quaternary'), era: msg('Cenozoic'), base: 2.58, color: '#F9F97F' },
  { name: msg('Neogene'), era: msg('Cenozoic'), base: 23.04, color: '#FFE619' },
  { name: msg('Paleogene'), era: msg('Cenozoic'), base: 66, color: '#FD9A52' },
  { name: msg('Cretaceous'), era: msg('Mesozoic'), base: 143.1, color: '#7FC64E' },
  { name: msg('Jurassic'), era: msg('Mesozoic'), base: 201.36, color: '#34B2C9' },
  { name: msg('Triassic'), era: msg('Mesozoic'), base: 251.9, color: '#812B92' },
  { name: msg('Permian'), era: msg('Paleozoic'), base: 298.89, color: '#F04028' },
  { name: msg('Carboniferous'), era: msg('Paleozoic'), base: 359.3, color: '#67A599' },
  { name: msg('Devonian'), era: msg('Paleozoic'), base: 419, color: '#CB8C37' },
  { name: msg('Silurian'), era: msg('Paleozoic'), base: 443.07, color: '#B3E1B6' },
  { name: msg('Ordovician'), era: msg('Paleozoic'), base: 486.85, color: '#009270' },
  { name: msg('Cambrian'), era: msg('Paleozoic'), base: 538.8, color: '#7FA056' },
  { name: msg('Ediacaran'), era: msg('Neoproterozoic'), base: 635, color: '#FED96A' },
  { name: msg('Cryogenian'), era: msg('Neoproterozoic'), base: 720, color: '#FECC5C' },
  { name: msg('Tonian'), era: msg('Neoproterozoic'), base: 1000, color: '#FEBF4E' },
  { name: msg('Stenian'), era: msg('Mesoproterozoic'), base: 1200, color: '#FED99A' },
  { name: msg('Ectasian'), era: msg('Mesoproterozoic'), base: 1400, color: '#F3CC8A' },
  { name: msg('Calymmian'), era: msg('Mesoproterozoic'), base: 1600, color: '#FDC07A' },
  { name: msg('Statherian'), era: msg('Paleoproterozoic'), base: 1800, color: '#F875A7' },
] as const;

export type Period = (typeof PERIODS)[number];

export function periodAt(ma: number): Period {
  return PERIODS.find(p => ma <= p.base) ?? PERIODS[PERIODS.length - 1];
}

const EN = createTranslator(DEFAULT_LOCALE, {});

const group = (n: number, digits: number, intl: string) => n.toLocaleString(intl, { minimumFractionDigits: digits, maximumFractionDigits: digits });

/** "250.0 Ma", "66.04 Ma", "120 ka": as many decimals as the motion at that age shows. */
export function formatMa(ma: number, intl = 'en') {
  if (ma < 1) return `${Math.round(ma * 1000)} ka`;
  return `${group(ma, ma < 100 ? 2 : 1, intl)} Ma`;
}

/** "250 million years ago", "1.2 billion years ago", "today". */
export function longMa(ma: number, t: Translate = EN) {
  if (ma < 0.001) return t('today');
  if (ma < 1) return t('{n} thousand years ago', { n: group(Math.round(ma * 1000), 0, t.intl) });
  if (ma >= 1000) return t('{n} billion years ago', { n: group(ma / 1000, ma % 100 ? 2 : 1, t.intl) });
  return t('{n} million years ago', { n: group(ma, ma < 10 ? 1 : 0, t.intl) });
}

/**
 * "250 Ma", "250 mya", "250 million years ago", "1.2 Ga", "1.2 billion years ago", "20 ka", "Jurassic"
 * (its start, also in `t`'s language) → Ma, or undefined when the text isn't a deep-time age.
 */
export function parseDeepJump(text: string, t: Translate = EN): number | undefined {
  const s = text.trim().toLowerCase().replace(/,/g, '');
  const period = PERIODS.find(p => p.name.toLowerCase() === s || t(p.name).toLocaleLowerCase(t.intl) === s);
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
