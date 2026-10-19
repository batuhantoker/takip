import type { Metadata } from 'next';
import { AreasIndex, areasIndexMetadata } from '@/components/site/places/areas-index';

export function generateMetadata(): Promise<Metadata> {
  return areasIndexMetadata('county');
}

export default function CountyIndexPage() {
  return <AreasIndex kind="county" />;
}
