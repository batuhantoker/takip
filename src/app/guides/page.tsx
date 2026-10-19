import type { Metadata } from 'next';
import { GuidesIndex, guidesIndexMetadata } from '@/components/site/guides/guide-pages';

export function generateMetadata(): Promise<Metadata> {
  return guidesIndexMetadata();
}

export default function GuidesIndexPage() {
  return <GuidesIndex />;
}
