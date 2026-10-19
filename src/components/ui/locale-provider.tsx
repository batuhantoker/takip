'use client';

import { useMemo, type ReactNode } from 'react';
import { setActiveTranslator } from '@/lib/core/i18n/active';
import type { Locale } from '@/lib/core/i18n/locales';
import { createTranslator, type Catalog } from '@/lib/core/i18n/translator';
import { LocaleContext, withRich } from './use-t';

type Props = { locale: Locale; chosen: Locale | null; automatic: Locale; catalog: Catalog; children: ReactNode };

/** Hands the request's language to every component, and in the browser to code outside React (i18n/active.ts). */
export default function LocaleProvider({ locale, chosen, automatic, catalog, children }: Props) {
  const state = useMemo(() => {
    const t = withRich(createTranslator(locale, catalog));
    // During render, not in an effect: children's effects and the map's first popups must already see it.
    if (typeof window !== 'undefined') setActiveTranslator(t);
    return { t, chosen, automatic };
  }, [locale, chosen, automatic, catalog]);
  return <LocaleContext value={state}>{children}</LocaleContext>;
}
