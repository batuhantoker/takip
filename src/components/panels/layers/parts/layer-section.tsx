'use client';

import { AlertTriangle, Camera, CloudSun, Layers, Map as MapIcon, Monitor, Plane, Satellite, Ship } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { primary, type LayerDef } from '@/components/panels/layers/layer-groups';
import { LayerRow, layerName, SubFilters } from './layer-row';
import { TemperatureUnitToggle } from './temperature-unit-toggle';
import { RadarLoopControl } from './radar-loop-control';
import { WindTimeNote } from './wind-time-note';
import { groupTitle, type LayerSection as Section } from '@/components/panels/layers/lib/layer-sections';
import { sourceFor } from '@/components/panels/layers/lib/layer-sources';
import { Disclosure } from '@/components/ui/disclosure';
import { useT } from '@/components/ui/use-t';
import { inSentence } from '@/components/panels/layers/lib/sentence-case';

const ICONS: Record<string, typeof Plane> = {
  air: Plane,
  sea: Ship,
  space: Satellite,
  weather: CloudSun,
  conflict: AlertTriangle,
  cameras: Camera,
  reference: MapIcon,
  display: Monitor,
};

export interface LayerSectionProps {
  section: Section;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeLayers: Record<string, boolean>;
  countOf: (layer: LayerDef) => number | null;
  detailOf?: (layer: LayerDef) => string | undefined;
  /** Searching shows sub-filters even under a layer that is off, so a match is never hidden. */
  searching: boolean;
  compact?: boolean;
  onToggle: (key: string) => void;
  onSetMany: (keys: string[], on: boolean) => void;
  /** Extra content under a group's rows, keyed by group label. */
  after?: (groupLabel: string) => React.ReactNode;
}

export default function LayerSection({ section, open, onOpenChange, activeLayers, countOf, detailOf, searching, compact, onToggle, onSetMany, after }: LayerSectionProps) {
  const t = useT();
  const counted = primary(section.groups.flatMap(g => g.layers));
  const on = counted.filter(l => activeLayers[l.key]).length;
  const title = t(section.title);
  const name = inSentence(title, t);
  const detail = (l: LayerDef) => {
    const text = detailOf ? detailOf(l) : sourceFor(l.key, l.description);
    return text && t(text);
  };

  return (
    <Disclosure
      icon={ICONS[section.id] ?? Layers}
      title={title}
      hint={on > 0 ? t('{n} on', { n: on }) : undefined}
      active={on > 0}
      open={open}
      onOpenChange={onOpenChange}
      action={open && counted.length > 1 ? (
        <Button variant="ghost" size="sm" aria-label={on ? t('Turn every {section} layer off', { section: name }) : t('Turn every {section} layer on', { section: name })}
          onClick={() => onSetMany(counted.map(l => l.key), !on)}>
          {on ? t('All off') : t('All on')}
        </Button>
      ) : undefined}
    >
      {section.groups.map(group => (
        <div key={group.label} className="not-first:mt-3">
          {section.subheadings && <h4 className="pt-1 pb-1 text-meta font-medium text-ink-3">{groupTitle(group, t)}</h4>}
          {primary(group.layers).map(layer => {
            const subs = group.layers.filter(l => l.parent === layer.key);
            const layerOn = !!activeLayers[layer.key];
            return (
              <div key={layer.key}>
                <LayerRow layer={layer} on={layerOn} count={countOf(layer)} detail={detail(layer)} compact={compact} onToggle={() => onToggle(layer.key)} />
                {subs.length > 0 && (layerOn || searching) && (
                  <SubFilters parentName={layerName(layer, t)} layers={subs} activeLayers={activeLayers} parentOn={layerOn} countOf={countOf} onToggle={onToggle} />
                )}
                {layer.key === 'wx_temperature' && (layerOn || searching) && <TemperatureUnitToggle />}
                {layer.key === 'wx_radar' && layerOn && <RadarLoopControl />}
                {layer.key === 'wx_wind' && layerOn && <WindTimeNote />}
              </div>
            );
          })}
          {after?.(group.label)}
        </div>
      ))}
    </Disclosure>
  );
}
