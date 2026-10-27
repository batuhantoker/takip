import type { Metadata } from 'next';
import { SkyIndex, skyIndexMetadata } from '@/components/site/space/sky-index';

export async function generateMetadata(): Promise<Metadata> {
  return skyIndexMetadata();
}

export default function DeepSkyRoute() {
  return <SkyIndex />;
}
