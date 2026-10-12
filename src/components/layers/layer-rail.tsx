'use client';

import { primary, type LayerGroupDef } from './layer-groups';

interface LayerRailProps {
  visibleGroups: LayerGroupDef[];
  activeLayers: Record<string, boolean>;
  hoveredGroup: string | null;
  setHoveredGroup: (label: string | null) => void;
  open: boolean;
  focusGroup: string | null;
  openAt: (label: string) => void;
}

export default function LayerRail({ visibleGroups, activeLayers, hoveredGroup, setHoveredGroup, open, focusGroup, openAt }: LayerRailProps) {
  return (
    <div className="flex-1 flex flex-col items-center gap-1">
      {visibleGroups.map((group) => {
        const counted = primary(group.layers);
        const activeCount = counted.filter(l => activeLayers[l.key]).length;
        const groupActive = activeCount > 0;
        const isHovered = hoveredGroup === group.label;
        const isFocused = open && focusGroup === group.label;
        const Icon = group.icon;

        return (
          <button
            key={group.label}
            type="button"
            onClick={() => openAt(group.label)}
            onMouseEnter={() => setHoveredGroup(group.label)}
            onMouseLeave={() => setHoveredGroup(null)}
            aria-expanded={open}
            aria-controls="layer-panel"
            aria-label={`${group.fullLabel}${activeCount ? ` — ${activeCount} active` : ''}`}
            title={group.fullLabel}
            className="relative w-10 h-10 flex items-center justify-center cursor-pointer rounded-lg transition-colors duration-200 focus:outline-none focus-visible:ring-1 focus-visible:ring-white/40"
            style={{
              background: isFocused
                ? 'rgba(255,255,255,0.10)'
                : isHovered ? 'rgba(255,255,255,0.05)' : 'transparent',
            }}
          >
            <Icon
              className="transition-all duration-300"
              style={{
                width: 16,
                height: 16,
                color: groupActive
                  ? 'rgba(255,255,255,0.75)'
                  : isHovered || isFocused
                    ? 'rgba(255,255,255,0.45)'
                    : 'rgba(255,255,255,0.22)',
                filter: groupActive ? 'drop-shadow(0 0 4px rgba(255,255,255,0.3))' : 'none',
              }}
            />
            {activeCount > 0 && (
              <span
                className="absolute top-1 right-1 min-w-[13px] h-[13px] px-[3px] rounded-full flex items-center justify-center text-[9px] font-mono tabular-nums leading-none"
                style={{
                  background: 'rgba(0,229,255,0.9)',
                  color: '#04040A',
                  boxShadow: '0 0 6px rgba(0,229,255,0.5)',
                }}
              >
                {activeCount}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
