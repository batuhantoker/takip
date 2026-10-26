import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { CountryMountains, countryForSlug, countryMountainsMetadata } from '@/components/site/mountains/mountain-lists';

type Props = { params: Promise<{ country: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const cc = countryForSlug((await params).country);
  return cc ? countryMountainsMetadata(cc) : {};
}

/** /mountains/<country>, by the country page's own slug: /mountains/turkey. */
export default async function CountryMountainsRoute({ params }: Props) {
  const cc = countryForSlug((await params).country);
  if (!cc) notFound();
  return <CountryMountains cc={cc} />;
}
