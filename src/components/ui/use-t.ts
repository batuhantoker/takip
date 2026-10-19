'use client';

import { createContext, createElement, Fragment, isValidElement, useContext, type ReactNode } from 'react';
import { DEFAULT_LOCALE, type Locale } from '@/lib/core/i18n/locales';
import { createTranslator, type Translate } from '@/lib/core/i18n/translator';

export interface RichTranslate extends Translate {
  /** A message with React nodes in it: t.rich('Data from {source}', { source: <a …/> }). */
  rich(source: string, vars: Record<string, ReactNode>): ReactNode;
}

export type LocaleState = {
  t: RichTranslate;
  /** The visitor's explicit pick, if any. */
  chosen: Locale | null;
  /** What their country and browser give without a pick. */
  automatic: Locale;
};

export function withRich(t: Translate): RichTranslate {
  const rich = t as RichTranslate;
  rich.rich = (source, vars) => createElement(Fragment, null, ...t.parts(source, vars).map((part, i) =>
    isValidElement(part) ? createElement(Fragment, { key: i }, part) : (part as ReactNode)));
  return rich;
}

const ENGLISH: LocaleState = { t: withRich(createTranslator(DEFAULT_LOCALE, {})), chosen: null, automatic: DEFAULT_LOCALE };

export const LocaleContext = createContext<LocaleState>(ENGLISH);

/** The translator for this page's language. Text in components goes through it; see docs/design/README.md. */
export const useT = () => useContext(LocaleContext).t;

export const useLocale = () => useContext(LocaleContext);
