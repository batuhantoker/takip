import type { Metadata } from 'next';
import { PlacesIndex, placesIndexMetadata } from '@/components/site/places/places-index';

export function generateMetadata(): Promise<Metadata> {
  return placesIndexMetadata('country');
}

export default function CountryIndexPage() {
  return <PlacesIndex kind="country" />;
}
