'use client';

import { AlertTriangle, Camera, ChevronRight, CloudSun, Layers, Map as MapIcon, Plane, Satellite, Ship } from 'lucide-react';
import { primary } from './layer-groups';
import { BulkButton, LayerRow } from './layer-row';
import { groupTitle, type LayerSection as Section } from './layer-sections';

const ICONS: Record<string, typeof Plane> = {
  air: Plane,
  sea: Ship,
  space: Satellite,
  weather: CloudSun,
  conflict: AlertTriangle,
  cameras: Camera,
  reference: MapIcon,
};

interface LayerSectionProps {
  section: Section;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeLayers: Record<string, boolean>;
  countOf: (dataKey: string, catKey?: string) => number | null;
  onToggle: (key: string) => void;
  onSetMany: (keys: string[], on: boolean) => void;
}

export default function LayerSection({ section, open, onOpenChange, activeLayers, countOf, onToggle, onSetMany }: LayerSectionProps) {
  const Icon = ICONS[section.id] ?? Layers;
  const counted = primary(section.groups.flatMap(g => g.layers));
  const on = counted.filter(l => activeLayers[l.key]).length;
  const bodyId = `layers-section-${section.id}`;
  const name = section.title.toLowerCase();

  return (
    <section className="border-b border-white/[0.06] last:border-b-0">
      <div className="flex items-center gap-1 pr-2">
        <button
          type="button"
          onClick={() => onOpenChange(!open)}
          aria-expanded={open}
          aria-controls={bodyId}
          className="flex flex-1 min-w-0 items-center gap-2 h-10 pl-3 text-left rounded-md hover:bg-white/[0.03] transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-white/30"
        >
          <ChevronRight aria-hidden className={`w-3.5 h-3.5 shrink-0 text-white/40 transition-transform duration-150 ${open ? 'rotate-90' : ''}`} />
          <Icon aria-hidden className={`w-4 h-4 shrink-0 ${on ? 'text-[var(--text-primary)]' : 'text-white/45'}`} />
          <span className="truncate text-[13px] font-medium text-[var(--text-primary)]">{section.title}</span>
          {on > 0 && <span className="shrink-0 text-[11px] font-mono tabular-nums text-[var(--cyan-primary)]">{on} on</span>}
        </button>
        {counted.length > 1 && (
          <BulkButton label={`Turn every ${name} layer ${on ? 'off' : 'on'}`} onClick={() => onSetMany(counted.map(l => l.key), !on)}>
            {on ? 'None' : 'All'}
          </BulkButton>
        )}
      </div>
      {open && (
        <div id={bodyId} className="px-1.5 pb-2">
          {section.groups.map(group => (
            <div key={group.label}>
              {section.subheadings && (
                <h3 className="px-2 pt-2 pb-1 text-[11px] font-medium text-[var(--text-secondary)]">{groupTitle(group)}</h3>
              )}
              {group.layers.map(layer => (
                <LayerRow
                  key={layer.key}
                  layer={layer}
                  active={!!activeLayers[layer.key]}
                  count={countOf(layer.dataKey, layer.catKey)}
                  dormant={!!layer.parent && !activeLayers[layer.parent]}
                  onToggle={() => onToggle(layer.key)}
                />
              ))}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
