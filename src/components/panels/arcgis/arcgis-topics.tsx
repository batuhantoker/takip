'use client';

import { Building2, LifeBuoy, Shield, Waypoints, Zap } from 'lucide-react';
import type { IconType } from '@/components/ui/class-names';
import { ListRow } from '@/components/ui/list-row';
import { PanelSection } from '@/components/ui/panel';
import { useT } from '@/components/ui/use-t';
import { msg } from '@/lib/core/i18n/translator';
import { CATEGORIES } from '@/lib/map/layers/arcgis';

const ABOUT: Record<string, { label: string; icon: IconType; blurb: string; search: string }> = {
  pipeline: { label: msg('Pipelines'), icon: Waypoints, blurb: msg('Oil, gas and product lines'), search: msg('Search for pipelines layers') },
  'power grid transmission': { label: msg('Power grid'), icon: Zap, blurb: msg('Transmission lines and substations'), search: msg('Search for power grid layers') },
  'critical infrastructure': { label: msg('Infrastructure'), icon: Building2, blurb: msg('Dams, bridges, plants and utilities'), search: msg('Search for infrastructure layers') },
  'military base installation': { label: msg('Military'), icon: Shield, blurb: msg('Bases and installations'), search: msg('Search for military layers') },
  'emergency shelter evacuation': { label: msg('Emergency'), icon: LifeBuoy, blurb: msg('Shelters and evacuation routes'), search: msg('Search for emergency layers') },
};

const TOPICS = CATEGORIES.map(c => ({ query: c.query, ...(ABOUT[c.query] ?? { label: c.label, icon: Waypoints, blurb: '', search: '' }) }));

/** Where to start when nothing has been searched: a few searches that tend to find good public layers. */
export function ArcgisTopics({ onPick }: { onPick: (query: string) => void }) {
  const t = useT();
  return (
    <>
      <PanelSection title={t('Start with a topic')}>
        {TOPICS.map(topic => (
          <ListRow key={topic.query} leading={<topic.icon aria-hidden className="size-4" strokeWidth={1.75} />}
            title={t(topic.label)} subtitle={<span className="text-ink-3">{topic.blurb && t(topic.blurb)}</span>} onClick={() => onPick(topic.query)}
            aria-label={topic.search ? t(topic.search) : t('Search for {topic} layers', { topic: topic.label.toLowerCase() })} />
        ))}
      </PanelSection>
      <p className="mt-6 text-small text-ink-3">
        {t('Layers are public map services that agencies and companies publish on ArcGIS Online. Each one loads up to 2,000 features from the area on screen.')}
      </p>
    </>
  );
}
