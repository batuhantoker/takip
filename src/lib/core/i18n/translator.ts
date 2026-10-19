import { intlTag, type Locale } from './locales';
import { formatMessage, formatParts } from './message';

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
}

export function createTranslator(locale: Locale, catalog: Catalog): Translate {
  const tag = intlTag(locale);
  const lookup = (source: string) => catalog[source] || source;
  const t = ((source: string, vars?: Vars) => formatMessage(lookup(source), vars, tag)) as Translate;
  t.parts = (source, vars) => formatParts(lookup(source), vars, tag);
  t.locale = locale;
  t.intl = tag;
  return t;
}

/** Marks a string in a table for the extractor; translate it where it renders, with t(label). */
export const msg = <S extends string>(source: S): S => source;
