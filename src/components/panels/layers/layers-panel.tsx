'use client';

import { memo, useState } from 'react';
import { ChevronsDownUp, SearchX } from 'lucide-react';
import { IconButton } from '@/components/ui/button';
import { cx } from '@/components/ui/class-names';
import { EmptyState } from '@/components/ui/empty-state';
import { Panel } from '@/components/ui/panel';
import { SearchField } from '@/components/ui/search-field';
import LayerSection from '@/components/panels/layers/parts/layer-section';
import LayersOnMap from '@/components/panels/layers/parts/layers-on-map';
import { useLayerBrowser } from './use-layer-browser';

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- the page's live data and layer state are untyped
type Loose = any;

interface LayersPaneProps {
  data: Loose;
  activeLayers: Record<string, boolean>;
  setActiveLayers: React.Dispatch<React.SetStateAction<Loose>>;
  /** Layers declaring a `requires` key stay hidden until that capability is present. */
  capabilities?: Record<string, boolean>;
  onClose: () => void;
}

const NO_CAPABILITIES: Record<string, boolean> = {};

/** The docked Layers panel: find a layer, see what is on, and switch things on and off by group. */
function LayersPane({ data, activeLayers, setActiveLayers, capabilities = NO_CAPABILITIES, onClose }: LayersPaneProps) {
  const b = useLayerBrowser({ data, activeLayers, setActiveLayers, capabilities });
  const [scrolled, setScrolled] = useState(false);

  return (
    <Panel
      title="Layers"
      meta={b.onMap.length > 0 ? `${b.onMap.length} on` : undefined}
      onClose={onClose}
      bare
      actions={<IconButton label="Collapse all groups" icon={ChevronsDownUp} disabled={!b.anyOpen} onClick={b.collapseAll} />}
    >
      <div className={cx('shrink-0 border-b px-4 pb-3 transition-colors duration-150', scrolled ? 'border-line' : 'border-transparent')}>
        <SearchField value={b.query} onChange={b.setQuery} placeholder={`Search ${b.layerTotal} layers`} autoComplete="off" spellCheck={false} />
      </div>
      <div className="styled-scrollbar min-h-0 flex-1 overflow-y-auto px-4 pt-1 pb-4" onScroll={e => setScrolled(e.currentTarget.scrollTop > 0)}>
        {!b.searching && (
          <div className="mb-5">
            <LayersOnMap items={b.onMap} undo={b.undo} onTurnOff={b.turnOff} onUndo={b.restore} />
          </div>
        )}
        {b.shown.length === 0 ? (
          <EmptyState icon={SearchX} title={`No layers match “${b.query.trim()}”`} body="Search matches layer names and their sources, such as ships, quakes or ADS-B." />
        ) : (
          <div>
            {b.searching && <p role="status" className="mb-1 text-meta text-ink-3">{b.matchCount === 1 ? '1 layer matches' : `${b.matchCount} layers match`}</p>}
            <div>
              {b.shown.map(section => (
                <LayerSection
                  key={section.id}
                  section={section}
                  open={b.isOpen(section.id)}
                  onOpenChange={open => b.setOpen(section.id, open)}
                  activeLayers={activeLayers}
                  countOf={b.countOf}
                  searching={b.searching}
                  onToggle={b.toggle}
                  onSetMany={(keys, on) => {
                    b.setMany(keys, on);
                    if (on) b.setOpen(section.id, true);
                  }}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </Panel>
  );
}

export default memo(LayersPane);
