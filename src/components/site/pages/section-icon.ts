import { AlertTriangle, Bus, Camera, CloudSun, Hourglass, Network, Newspaper, Plane, Satellite, Ship, Wrench } from 'lucide-react';
import type { IconType } from '@/components/ui/class-names';
import type { SectionId } from '@/lib/platform/site/layer-pages';

/** One icon per section, shown beside its name. */
export const SECTION_ICON: Record<SectionId, IconType> = {
  air: Plane, sea: Ship, space: Satellite, weather: CloudSun, hazards: AlertTriangle, cameras: Camera,
  ground: Bus, world: Newspaper, network: Network, past: Hourglass, tools: Wrench,
};
