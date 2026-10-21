'use client';

import { use, useMemo, type ReactNode } from 'react';
import { setActiveTranslator } from '@/lib/core/i18n/active';
import { loadCatalog } from '@/lib/core/i18n/catalog';
import type { Locale } from '@/lib/core/i18n/locales';
import { createTranslator, type Catalog } from '@/lib/core/i18n/translator';
import { LocaleContext, withRich } from './use-t';

type Props = { locale: Locale; chosen: Locale | null; automatic: Locale; children: ReactNode };

const ENGLISH: Catalog = {};
const loading = new Map<Locale, Promise<Catalog>>();

// Loaded here, not passed as a prop: Next would inline a prop's whole catalog in every page's HTML.
function catalogFor(locale: Locale): Promise<Catalog> {
  let p = loading.get(locale);
  // A failed chunk falls back to English rather than leaving the root suspended; kept cached so it doesn't retry in a loop.
  if (!p) loading.set(locale, (p = loadCatalog(locale).catch(() => ENGLISH)));
  return p;
}

/** Hands the request's language to every component, and in the browser to code outside React (i18n/active.ts). */
export default function LocaleProvider({ locale, chosen, automatic, children }: Props) {
  const catalog = locale === 'en' ? ENGLISH : use(catalogFor(locale));
  const state = useMemo(() => {
    const t = withRich(createTranslator(locale, catalog));
    // During render, not in an effect: children's effects and the map's first popups must already see it.
    if (typeof window !== 'undefined') setActiveTranslator(t);
    return { t, chosen, automatic };
  }, [locale, chosen, automatic, catalog]);
  return <LocaleContext value={state}>{children}</LocaleContext>;
}
