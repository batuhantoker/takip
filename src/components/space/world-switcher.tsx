'use client';

import { motion } from 'framer-motion';
import { Orbit } from 'lucide-react';
import type { WorldId } from '@/lib/space/worlds';

interface WorldOption {
  id: WorldId;
  label: string;
  title: string;
  /** A disc in the body's colour; the solar system gets an orbit glyph instead. */
  swatch?: string;
}

export const WORLD_OPTIONS: WorldOption[] = [
  { id: 'earth', label: 'EARTH', title: 'Earth — the live map', swatch: 'radial-gradient(circle at 35% 35%, #7cc4ff, #1d5fae 70%)' },
  { id: 'moon', label: 'MOON', title: 'The Moon — NASA LRO imagery, landing sites and orbiters', swatch: 'radial-gradient(circle at 35% 35%, #f2f2f2, #8a8a8a 70%)' },
  { id: 'mars', label: 'MARS', title: 'Mars — Viking imagery, the rovers and the orbiters', swatch: 'radial-gradient(circle at 35% 35%, #ffad84, #b8401f 70%)' },
  { id: 'sun', label: 'SUN', title: 'The Sun — live from NASA SDO and SOHO', swatch: 'radial-gradient(circle at 40% 40%, #fff3b0, #ffb72a 60%, #ff7a00)' },
  { id: 'solar', label: 'SYSTEM', title: 'The solar system — planets and every spacecraft JPL tracks' },
];

export default function WorldSwitcher({ world, onWorld }: { world: WorldId; onWorld: (w: WorldId) => void }) {
  return (
    <div role="radiogroup" aria-label="World" className="flex items-center gap-[3px] p-[3px] pointer-events-auto rounded-xl border border-[var(--border-primary)] bg-[var(--bg-panel)] backdrop-blur-2xl shadow-[0_8px_32px_rgba(0,0,0,0.55)]">
      {WORLD_OPTIONS.map(o => {
        const active = world === o.id;
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onWorld(o.id)}
            title={o.title}
            className={`relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[10px] font-mono font-medium tracking-[0.18em] transition-colors duration-200 ${
              active ? 'text-[var(--gold-light)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            {active && (
              <motion.span
                layoutId="view-world"
                transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                className="absolute inset-0 rounded-md border border-[var(--border-active)] bg-[var(--gold-primary)]/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_0_14px_var(--gold-glow)]"
              />
            )}
            {o.swatch
              ? <span aria-hidden className="relative z-10 w-3 h-3 rounded-full shadow-[0_0_6px_rgba(255,255,255,0.15)]" style={{ background: o.swatch, opacity: active ? 1 : 0.75 }} />
              : <Orbit className="relative z-10 w-3.5 h-3.5" />}
            <span className={`relative z-10 ${active ? 'inline' : 'hidden lg:inline'}`}>{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}
