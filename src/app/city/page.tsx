import type { Metadata } from 'next';
import { PlacesIndex, placesIndexMetadata } from '@/components/site/places/places-index';

export function generateMetadata(): Promise<Metadata> {
  return placesIndexMetadata('city');
}

export default function CityIndexPage() {
  return <PlacesIndex kind="city" />;
}
