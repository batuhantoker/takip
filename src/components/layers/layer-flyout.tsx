'use client';

import { motion, AnimatePresence } from 'framer-motion';
import type { LayerDef, LayerGroupDef } from './layer-groups';

/** Two columns of about equal height, in order. Weighed from the definitions alone so no group
 *  jumps columns when a layer is switched or the terrain notes open. */
function splitColumns<T extends { layers: LayerDef[] }>(groups: T[]): [T[], T[]] {
  const weight = (g: T) => 1.5 + g.layers.reduce((n, l) => n + (l.description ? 1.4 : 1), 0);
  const total = groups.reduce((n, g) => n + weight(g), 0);
  let split = 0, bestDiff = Infinity, acc = 0;
  for (let k = 0; k <= groups.length; k++) {
    const diff = Math.abs(total - 2 * acc);
    if (diff < bestDiff) { bestDiff = diff; split = k; }
    if (k < groups.length) acc += weight(groups[k]);
  }
  return [groups.slice(0, split), groups.slice(split)];
}

interface LayerFlyoutProps {
  open: boolean;
  setOpen: (open: boolean) => void;
  visibleGroups: LayerGroupDef[];
  hoveredGroup: string | null;
  focusGroup: string | null;
  sectionRefs: React.RefObject<Record<string, HTMLElement | null>>;
  masterControls: React.ReactNode;
  searchField: React.ReactNode;
  renderGroup: (group: LayerGroupDef) => React.ReactNode;
}

export default function LayerFlyout({ open, setOpen, visibleGroups, hoveredGroup, focusGroup, sectionRefs, masterControls, searchField, renderGroup }: LayerFlyoutProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          id="layer-panel"
          role="dialog"
          aria-label="Map layers"
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -6 }}
          transition={{ duration: 0.16, ease: 'easeOut' }}
          // Stops above the map view strip in the bottom-left corner.
          className="absolute left-[52px] top-24 w-[264px] lg:w-[492px] max-h-[calc(100%-264px)] flex flex-col rounded-xl z-[100] pointer-events-auto"
          style={{
            background: 'var(--bg-panel-solid)',
            border: '1px solid rgba(255,255,255,0.1)',
            boxShadow: '0 12px 40px rgba(0,0,0,0.65)',
          }}
        >
          <div className="flex items-center gap-2 px-3 pt-2.5 pb-2 border-b border-white/[0.1] shrink-0">
            <span className="text-[10px] font-mono tracking-[0.2em] uppercase text-white/90">Layers</span>
            {masterControls}
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close layers"
              className="ml-1 px-1.5 py-0.5 rounded text-[10px] font-mono text-white/70 hover:text-white hover:bg-white/10 transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-white/30"
            >
              ✕
            </button>
          </div>
          <div className="px-3 pt-2 shrink-0">{searchField}</div>
          {visibleGroups.length === 0 ? <p className="px-3 py-4 text-[11px] text-white/50">No layers match.</p> : (
            <div className="min-h-0 overflow-y-auto styled-scrollbar p-2 flex flex-col lg:flex-row gap-2">
              {splitColumns(visibleGroups).filter(column => column.length > 0).map((column, i) => (
                <div key={i} className="flex-1 min-w-0 flex flex-col gap-1">
                  {column.map((group) => {
                    const lit = (hoveredGroup ?? focusGroup) === group.label;
                    return (
                      <section
                        key={group.label}
                        ref={el => { sectionRefs.current[group.label] = el; }}
                        className="rounded-lg p-2 transition-colors duration-200"
                        style={{ background: lit ? 'rgba(255,255,255,0.06)' : 'transparent' }}
                      >
                        {renderGroup(group)}
                      </section>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
