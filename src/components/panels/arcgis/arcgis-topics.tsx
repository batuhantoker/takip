'use client';

import { Building2, LifeBuoy, Shield, Waypoints, Zap } from 'lucide-react';
import type { IconType } from '@/components/ui/class-names';
import { ListRow } from '@/components/ui/list-row';
import { PanelSection } from '@/components/ui/panel';
import { CATEGORIES } from '@/lib/map/layers/arcgis';

const ABOUT: Record<string, { label: string; icon: IconType; blurb: string }> = {
  pipeline: { label: 'Pipelines', icon: Waypoints, blurb: 'Oil, gas and product lines' },
  'power grid transmission': { label: 'Power grid', icon: Zap, blurb: 'Transmission lines and substations' },
  'critical infrastructure': { label: 'Infrastructure', icon: Building2, blurb: 'Dams, bridges, plants and utilities' },
  'military base installation': { label: 'Military', icon: Shield, blurb: 'Bases and installations' },
  'emergency shelter evacuation': { label: 'Emergency', icon: LifeBuoy, blurb: 'Shelters and evacuation routes' },
};

const TOPICS = CATEGORIES.map(c => ({ query: c.query, ...(ABOUT[c.query] ?? { label: c.label, icon: Waypoints, blurb: '' }) }));

/** Where to start when nothing has been searched: a few searches that tend to find good public layers. */
export function ArcgisTopics({ onPick }: { onPick: (query: string) => void }) {
  return (
    <>
      <PanelSection title="Start with a topic">
        {TOPICS.map(t => (
          <ListRow key={t.query} leading={<t.icon aria-hidden className="size-4" strokeWidth={1.75} />}
            title={t.label} subtitle={<span className="text-ink-3">{t.blurb}</span>} onClick={() => onPick(t.query)}
            aria-label={`Search for ${t.label.toLowerCase()} layers`} />
        ))}
      </PanelSection>
      <p className="mt-6 text-small text-ink-3">
        Layers are public map services that agencies and companies publish on ArcGIS Online.
        Each one loads up to 2,000 features from the area on screen.
      </p>
    </>
  );
}
