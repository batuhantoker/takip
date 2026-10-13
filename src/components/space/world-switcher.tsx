'use client';

import { motion } from 'framer-motion';
import { MapPinned, Orbit, Sparkles, type LucideIcon } from 'lucide-react';
import type { SpaceFocus } from '@/lib/space/worlds';

/** Map, or out into space and centred on one of these; the camera flies between them. */
interface FocusOption {
  id: SpaceFocus;
  label: string;
  title: string;
  swatch?: string;
  icon?: LucideIcon;
}

export const FOCUS_OPTIONS: FocusOption[] = [
  { id: 'earth', label: 'Earth', title: 'Leave the map and see Earth from space, with its satellites', swatch: 'radial-gradient(circle at 35% 35%, #7cc4ff, #1d5fae 70%)' },
  { id: 'moon', label: 'Moon', title: 'Fly to the Moon: NASA LRO imagery, landing sites and orbiters', swatch: 'radial-gradient(circle at 35% 35%, #f2f2f2, #8a8a8a 70%)' },
  { id: 'mars', label: 'Mars', title: 'Fly to Mars: Viking imagery, the rovers and the orbiters', swatch: 'radial-gradient(circle at 35% 35%, #ffad84, #b8401f 70%)' },
  { id: 'sun', label: 'Sun', title: 'Fly to the Sun: the latest frame from NASA SDO', swatch: 'radial-gradient(circle at 40% 40%, #fff3b0, #ffb72a 60%, #ff7a00)' },
  { id: 'solar', label: 'System', title: 'Pull back to the planets and every spacecraft JPL tracks', icon: Orbit },
  { id: 'stars', label: 'Stars', title: 'Out past the heliopause to the nearest stars, each at its real distance (Gaia, Hipparcos), with the ones known to have planets', icon: Sparkles },
  { id: 'galaxy', label: 'Galaxy', title: 'The Milky Way from outside (illustration), with the Sun and Sagittarius A* where they really are', swatch: 'radial-gradient(ellipse at 50% 50%, #fff3d6 0%, #d8c2ff 28%, rgba(120,110,200,0.35) 55%, transparent 72%)' },
  { id: 'universe', label: 'Universe', title: 'Out to the edge of the observable universe: 2MASS and SDSS galaxies and quasars, and the cosmic microwave background (NASA WMAP)', swatch: 'radial-gradient(circle at 35% 35%, #ffb36b 0%, #e8564a 30%, #3a6fd8 65%, #1b2f7a 100%)' },
];

const SEGMENT = 'relative h-8 flex items-center gap-1.5 px-2.5 rounded-md text-[11px] transition-colors duration-200';

function Highlight() {
  return (
    <motion.span
      layoutId="view-world"
      transition={{ type: 'spring', stiffness: 420, damping: 34 }}
      className="absolute inset-0 rounded-md border border-[var(--border-active)] bg-[var(--gold-primary)]/10"
    />
  );
}

export default function WorldSwitcher({ inSpace, focus, onMap, onSpace }: {
  inSpace: boolean;
  focus: SpaceFocus;
  onMap: () => void;
  onSpace: (focus: SpaceFocus) => void;
}) {
  const tone = (active: boolean) => (active ? 'text-[var(--gold-light)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]');
  return (
    <div role="radiogroup" aria-label="View" className="flex items-center gap-[3px] p-[3px] pointer-events-auto rounded-xl border border-white/10 bg-[var(--bg-panel)] backdrop-blur-2xl shadow-[0_8px_32px_rgba(0,0,0,0.55)]">
      <button type="button" role="radio" aria-checked={!inSpace} onClick={onMap} title="The live map" className={`${SEGMENT} ${tone(!inSpace)}`}>
        {!inSpace && <Highlight />}
        <MapPinned className="relative z-10 w-3.5 h-3.5" />
        <span className="relative z-10">Map</span>
      </button>
      <div className="w-px h-5 mx-1 bg-white/10" />
      {FOCUS_OPTIONS.map(o => {
        const active = inSpace && focus === o.id;
        return (
          <button key={o.id} type="button" role="radio" aria-checked={active} onClick={() => onSpace(o.id)} title={o.title} className={`${SEGMENT} ${tone(active)}`}>
            {active && <Highlight />}
            {o.swatch
              ? <span aria-hidden className="relative z-10 w-3 h-3 rounded-full shadow-[0_0_6px_rgba(255,255,255,0.15)]" style={{ background: o.swatch, opacity: active ? 1 : 0.75 }} />
              : o.icon && <o.icon className="relative z-10 w-3.5 h-3.5" />}
            <span className={`relative z-10 ${active ? 'inline' : 'hidden lg:inline'}`}>{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}
