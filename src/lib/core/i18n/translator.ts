import { intlTag, type Locale } from './locales';
import { formatMessage, formatParts, type Format } from './message';

/** English source → translation. English itself has no catalog. */
export type Catalog = Record<string, string>;
export type Vars = Record<string, string | number>;

export interface Translate {
  (source: string, vars?: Vars): string;
  /** The message as pieces, for values that aren't text. */
  parts(source: string, vars: Record<string, unknown>): unknown[];
  locale: Locale;
  /** The tag for Intl formatters and toLocaleString. */
  intl: string;
  /** `{km, distance}` in kilometres or in miles; a page about a place reads its unit (copy/weather-words.ts unitsFor). */
  distance: DistanceUnit;
  /** This translator, writing distances in `unit`. */
  inUnit(unit: DistanceUnit): Translate;
}

export type DistanceUnit = 'km' | 'mi';

const KM_PER_MI = 1.609344;

/** 7.5 → 8, 19 → 20, 62 → 60, 186 → 190, 620 → 600: the nearest whole, five, ten, fifty or hundred as miles grow. */
export function roundMiles(mi: number): number {
  const step = mi < 10 ? 1 : mi < 50 ? 5 : mi < 200 ? 10 : mi < 1000 ? 50 : 100;
  return Math.max(1, Math.round(mi / step) * step);
}

/** 'rail|Layers': the same English with its own translation where the room or the meaning differs. */
const CONTEXT = /^[a-z][a-z-]*\|(?=\S)/;

/** The English a key shows, without its context. */
export const bareSource = (source: string) => source.replace(CONTEXT, '');

export function createTranslator(locale: Locale, catalog: Catalog, unit: DistanceUnit = 'km'): Translate {
  const tag = intlTag(locale);
  const lookup = (source: string) => catalog[source] || catalog[bareSource(source)] || bareSource(source);
  // A decimal under ten ("3.5 mi"), whole numbers from there; a radius in miles rounds as people would say it.
  const distance = (km: number, round: boolean) => {
    const n = unit === 'mi' ? km / KM_PER_MI : km;
    const shown = round && unit === 'mi' ? roundMiles(n) : n;
    const value = new Intl.NumberFormat(tag, { maximumFractionDigits: shown < 10 && !round ? 1 : 0 }).format(shown);
    return formatMessage(lookup(unit === 'mi' ? '{n} mi' : '{n} km'), { n: value }, tag);
  };
  const format: Format = { tag, distance };
  const t = ((source: string, vars?: Vars) => formatMessage(lookup(source), vars, format)) as Translate;
  t.parts = (source, vars) => formatParts(lookup(source), vars, format);
  t.locale = locale;
  t.intl = tag;
  t.distance = unit;
  t.inUnit = next => (next === unit ? t : createTranslator(locale, catalog, next));
  return t;
}

/** Marks a string in a table for the extractor; translate it where it renders, with t(label). */
export const msg = <S extends string>(source: S): S => source;
