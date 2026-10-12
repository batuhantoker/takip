'use client';

import { AnimatePresence } from 'framer-motion';
import { Ghost, SlidersHorizontal } from 'lucide-react';
import StyleStudio from '@/components/shell/style-studio';
import type { LayerGroupDef } from './layer-groups';

interface LayerListMobileProps {
  visibleGroups: LayerGroupDef[];
  masterControls: React.ReactNode;
  renderGroup: (group: LayerGroupDef, mobile?: boolean) => React.ReactNode;
  studioOpen: boolean;
  setStudioOpen: React.Dispatch<React.SetStateAction<boolean>>;
  theme: 'core' | 'ghost';
  setTheme?: (theme: 'core' | 'ghost') => void;
}

export default function LayerListMobile({ visibleGroups, masterControls, renderGroup, studioOpen, setStudioOpen, theme, setTheme }: LayerListMobileProps) {
  return (
    <div className="flex flex-col gap-5 py-2">
      <div className="flex items-center gap-2 px-1">
        <span className="text-[10px] font-mono tracking-[0.2em] uppercase text-white/85">All layers</span>
        {masterControls}
      </div>
      {visibleGroups.map((group) => (
        <div key={group.label}>{renderGroup(group, true)}</div>
      ))}

      {/* MOBILE STYLE STUDIO */}
      <div className="flex items-center justify-between mt-2 pt-3 border-t border-white/[0.06] px-1">
        <span className="text-[10px] font-mono tracking-[0.2em] text-white/25 uppercase">Style Studio</span>
        <button
          onClick={() => setStudioOpen(o => !o)}
          aria-pressed={studioOpen}
          className="w-8 h-8 rounded-full flex items-center justify-center transition-all"
          style={{
            background: studioOpen ? 'var(--hover-accent)' : 'transparent',
            boxShadow: studioOpen ? '0 0 12px var(--gold-glow)' : 'none',
          }}
        >
          <SlidersHorizontal className="w-4 h-4" style={{ color: studioOpen ? 'var(--gold-primary)' : 'rgba(255,255,255,0.25)' }} />
        </button>
      </div>
      <AnimatePresence>
        {studioOpen && <StyleStudio isMobile onClose={() => setStudioOpen(false)} />}
      </AnimatePresence>

      {/* MOBILE GHOST TOGGLE */}
      {setTheme && (
        <div className="flex items-center justify-between pt-3 border-t border-white/[0.06] px-1">
          <span className="text-[10px] font-mono tracking-[0.2em] text-white/25 uppercase">Ghost Protocol</span>
          <button
            onClick={() => setTheme(theme === 'core' ? 'ghost' : 'core')}
            className="w-8 h-8 rounded-full flex items-center justify-center transition-all"
            style={{
              background: theme === 'ghost' ? 'rgba(179, 136, 255, 0.15)' : 'transparent',
              boxShadow: theme === 'ghost' ? '0 0 12px rgba(179, 136, 255, 0.3)' : 'none',
            }}
          >
            <Ghost className="w-4 h-4" style={{ color: theme === 'ghost' ? '#B388FF' : 'rgba(255,255,255,0.25)' }} />
          </button>
        </div>
      )}
    </div>
  );
}
