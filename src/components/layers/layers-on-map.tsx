'use client';

import { useState } from 'react';
import { X } from 'lucide-react';

/** About three rows at panel width; past that the list folds behind "+n more". */
const FOLDED = 6;

export interface OnMapItem {
  key: string;
  label: string;
  count: number | null;
}

/** The layers drawing right now, each removable on its own. */
export default function LayersOnMap({ items, onTurnOff, onTurnAllOff }: {
  items: OnMapItem[]; onTurnOff: (key: string) => void; onTurnAllOff: () => void;
}) {
  const [unfolded, setUnfolded] = useState(false);
  const folds = items.length > FOLDED + 1;
  const visible = folds && !unfolded ? items.slice(0, FOLDED) : items;
  return (
    <div>
      <div className="flex items-center gap-2 h-6">
        <span className="text-[12px] font-medium text-[var(--text-secondary)]">On the map</span>
        {items.length > 0 && <span className="text-[11px] font-mono tabular-nums text-[var(--cyan-primary)]">{items.length}</span>}
        <span className="flex-1" />
        {items.length > 0 && (
          <button
            type="button"
            onClick={onTurnAllOff}
            className="px-2 py-0.5 rounded text-[11px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/[0.07] transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-white/30"
          >
            Turn all off
          </button>
        )}
      </div>
      {items.length === 0 ? (
        <p className="mt-1 text-[12px] text-white/45">Nothing on the map yet. Switch a layer on below.</p>
      ) : (
        <ul className="mt-1.5 flex flex-wrap gap-1.5 max-h-[40vh] overflow-y-auto styled-scrollbar">
          {visible.map(item => (
            <li
              key={item.key}
              className="inline-flex items-center gap-1.5 h-6 pl-2.5 pr-0.5 rounded-full border border-[rgba(var(--cyan-rgb),0.22)] bg-[rgba(var(--cyan-rgb),0.06)] text-[12px] text-[var(--text-primary)]"
            >
              <span className="truncate max-w-[180px]">{item.label}</span>
              {item.count !== null && <span className="font-mono tabular-nums text-[11px] text-white/50">{item.count.toLocaleString()}</span>}
              <button
                type="button"
                onClick={() => onTurnOff(item.key)}
                aria-label={`Turn off ${item.label}`}
                title="Turn off"
                className="w-5 h-5 flex items-center justify-center rounded-full text-white/45 hover:text-white hover:bg-white/10 transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-white/30"
              >
                <X aria-hidden className="w-3 h-3" />
              </button>
            </li>
          ))}
          {folds && (
            <li>
              <button
                type="button"
                onClick={() => setUnfolded(u => !u)}
                aria-expanded={unfolded}
                className="h-6 px-2.5 rounded-full border border-white/10 text-[12px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/[0.06] transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-white/30"
              >
                {unfolded ? 'Show fewer' : `+${items.length - FOLDED} more`}
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
