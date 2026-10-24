import type { Metadata } from 'next';
import { SpacecraftIndex, spacecraftIndexMetadata } from '@/components/site/space/spacecraft-index';

export async function generateMetadata(): Promise<Metadata> {
  return spacecraftIndexMetadata();
}

export default function SpacecraftRoute() {
  return <SpacecraftIndex />;
}
