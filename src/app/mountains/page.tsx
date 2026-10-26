import type { Metadata } from 'next';
import { MountainsIndex, mountainsIndexMetadata } from '@/components/site/mountains/mountain-lists';

export async function generateMetadata(): Promise<Metadata> {
  return mountainsIndexMetadata();
}

export default function MountainsRoute() {
  return <MountainsIndex />;
}
