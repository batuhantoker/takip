'use client';

import { memo, useState } from 'react';
import { LAYER_GROUPS, primary } from './layer-groups';
import { layerCount } from './layer-count';
import LayerSearchField from './layer-search-field';
import LayerSection from './layer-section';
import { filterSections, groupSections, type LayerSection as Section } from './layer-sections';
import LayersOnMap from './layers-on-map';
import { sentenceCase } from './sentence-case';

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- the page's live data and layer state are untyped
type Loose = any;

interface LayersPaneProps {
  data: Loose;
  activeLayers: Record<string, boolean>;
  setActiveLayers: React.Dispatch<React.SetStateAction<Loose>>;
  /** Layers declaring a `requires` key stay hidden until that capability is present. */
  capabilities?: Record<string, boolean>;
}

const NO_CAPABILITIES: Record<string, boolean> = {};

const anyOn = (section: Section, activeLayers: Record<string, boolean>) =>
  primary(section.groups.flatMap(g => g.layers)).some(l => activeLayers[l.key]);

function LayersPane({ data, activeLayers, setActiveLayers, capabilities = NO_CAPABILITIES }: LayersPaneProps) {
  const [query, setQuery] = useState('');
  // Snapshotted once, so turning a section's last layer off doesn't fold it away under the cursor.
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(groupSections(LAYER_GROUPS).map(s => [s.id, anyOn(s, activeLayers)])));

  const sections = groupSections(
    LAYER_GROUPS.map(g => ({ ...g, layers: g.layers.filter(l => !l.requires || capabilities[l.requires]) }))
      .filter(g => g.layers.length > 0),
  );
  const shown = filterSections(sections, query);
  const searching = query.trim().length > 0;
  const countOf = (dataKey: string, catKey?: string) => layerCount(data, dataKey, catKey);

  const onMap = sections
    .flatMap(s => s.groups.flatMap(g => primary(g.layers)))
    .filter(l => activeLayers[l.key])
    .map(l => ({ key: l.key, label: sentenceCase(l.label), count: countOf(l.dataKey, l.catKey) }));

  const setMany = (keys: string[], on: boolean) =>
    setActiveLayers((prev: Record<string, boolean>) => ({ ...prev, ...Object.fromEntries(keys.map(k => [k, on])) }));
  const toggle = (key: string) => setActiveLayers((prev: Record<string, boolean>) => ({ ...prev, [key]: !prev[key] }));
  const setOpen = (id: string, open: boolean) => setExpanded(prev => ({ ...prev, [id]: open }));

  return (
    <div className="flex flex-col min-h-0 h-full">
      <div className="shrink-0 flex flex-col gap-3 px-3 pt-3 pb-3 border-b border-white/[0.06]">
        <LayerSearchField query={query} setQuery={setQuery} />
        <LayersOnMap
          items={onMap}
          onTurnOff={key => setMany([key], false)}
          onTurnAllOff={() => setMany(onMap.map(i => i.key), false)}
        />
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto styled-scrollbar px-1.5 py-1">
        {shown.length === 0 && <p className="px-3 py-6 text-[12px] text-[var(--text-secondary)]">No layers match “{query.trim()}”.</p>}
        {shown.map(section => (
          <LayerSection
            key={section.id}
            section={section}
            open={searching || (expanded[section.id] ?? false)}
            onOpenChange={open => setOpen(section.id, open)}
            activeLayers={activeLayers}
            countOf={countOf}
            onToggle={toggle}
            onSetMany={(keys, on) => {
              setMany(keys, on);
              if (on) setOpen(section.id, true);
            }}
          />
        ))}
      </div>
    </div>
  );
}

export default memo(LayersPane);
