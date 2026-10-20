import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { CompareIndex, compareIndexMetadata } from '@/components/site/compare/compare-index';
import { requestLocale } from '@/lib/core/i18n/request';
import { comparePath } from '@/lib/platform/site/compare/compare';
import { localePath } from '@/lib/platform/site/locale-path';
import { placeBySlug } from '@/lib/platform/site/places/gazetteer';

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export function generateMetadata(): Promise<Metadata> {
  return compareIndexMetadata();
}

/** /compare, and /compare?a=greece&b=turkey from its form, which goes on to the pair's page. */
export default async function CompareIndexRoute({ searchParams }: Props) {
  const { a, b } = await searchParams;
  const x = typeof a === 'string' ? placeBySlug('country', a) : undefined;
  const y = typeof b === 'string' ? placeBySlug('country', b) : undefined;
  if (x && y && x.id !== y.id) redirect(localePath((await requestLocale()).locale, comparePath({ a: x, b: y })));
  return CompareIndex();
}
