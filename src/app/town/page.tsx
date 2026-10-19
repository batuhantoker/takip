import type { Metadata } from 'next';
import { AreasIndex, areasIndexMetadata } from '@/components/site/places/areas-index';

export function generateMetadata(): Promise<Metadata> {
  return areasIndexMetadata('town');
}

export default function TownIndexPage() {
  return <AreasIndex kind="town" />;
}
