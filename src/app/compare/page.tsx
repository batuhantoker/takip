import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { CompareIndex, compareIndexMetadata } from '@/components/site/compare/compare-index';
import { requestLocale } from '@/lib/core/i18n/request';
import { comparePath } from '@/lib/platform/site/compare/compare';
import { findCountry } from '@/lib/platform/site/compare/countries';
import { localePath } from '@/lib/platform/site/locale-path';
import { siteText } from '@/lib/platform/site/text';

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export function generateMetadata(): Promise<Metadata> {
  return compareIndexMetadata();
}

/** /compare, and /compare?a=greece&b=Türkiye from its form (a slug or a name as typed), which goes on to the pair's page. */
export default async function CompareIndexRoute({ searchParams }: Props) {
  const { a, b } = await searchParams;
  const { t, locale } = await siteText((await requestLocale()).locale);
  const x = typeof a === 'string' ? findCountry(a, t) : undefined;
  const y = typeof b === 'string' ? findCountry(b, t) : undefined;
  if (x && y && x.id !== y.id) redirect(localePath(locale, comparePath({ a: x, b: y })));
  return CompareIndex();
}
