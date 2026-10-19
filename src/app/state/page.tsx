import type { Metadata } from 'next';
import { AreasIndex, areasIndexMetadata } from '@/components/site/places/areas-index';

export function generateMetadata(): Promise<Metadata> {
  return areasIndexMetadata('state');
}

export default function StateIndexPage() {
  return <AreasIndex kind="state" />;
}
