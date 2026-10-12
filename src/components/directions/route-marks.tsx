'use client';

import type { ReactNode } from 'react';
import {
  MapPin, CornerUpRight, CornerUpLeft, ArrowUp, RotateCw, Merge, type LucideIcon,
} from 'lucide-react';

/** The start: a hollow ivory ring, as on the rail. */
export function StartMark({ size = 12 }: { size?: number }) {
  return <span className="rounded-full flex-shrink-0 border-2 border-[var(--text-heading)] bg-black" style={{ width: size, height: size }} />;
}

/** The destination: a gold pin, as on the rail. */
export function EndMark({ className = 'w-4 h-4' }: { className?: string }) {
  return <MapPin className={`${className} flex-shrink-0`} style={{ color: 'var(--gold-primary)', fill: 'rgba(var(--gold-rgb),0.28)' }} />;
}

/** A stop on the way: a small gold diamond. */
export function StopMark() {
  return <span className="w-2 h-2 rotate-45 flex-shrink-0" style={{ background: 'var(--gold-light)', opacity: 0.8 }} />;
}

const MANEUVER: Array<[(t: string) => boolean, LucideIcon]> = [
  [t => t === 'roundabout', RotateCw],
  [t => t === 'merge', Merge],
  [t => t.includes('right'), CornerUpRight],
  [t => t.includes('left'), CornerUpLeft],
];

/** A step's maneuver in a tile; the start and the end wear the rail's own marks. */
export function StepIcon({ type, on = false }: { type: string; on?: boolean }) {
  const tile = (child: ReactNode) => (
    <span className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 border transition-colors"
      style={{ borderColor: on ? 'rgba(var(--gold-rgb),0.45)' : 'rgba(255,255,255,0.07)', background: on ? 'rgba(var(--gold-rgb),0.12)' : 'rgba(255,255,255,0.03)' }}>
      {child}
    </span>
  );
  if (type === 'depart') return tile(<StartMark size={10} />);
  if (type === 'arrive') return tile(<EndMark className="w-3.5 h-3.5" />);
  const Icon = MANEUVER.find(([test]) => test(type))?.[1] ?? ArrowUp;
  const turn = Icon !== ArrowUp;
  return tile(<Icon className="w-3.5 h-3.5" style={{ color: on ? 'var(--gold-light)' : turn ? 'var(--text-heading)' : 'var(--text-muted)' }} />);
}

/** One place on the rail: its mark, and the dotted line down to the next. */
export function RailRow({ mark, last = false, children }: { mark: ReactNode; last?: boolean; children: ReactNode }) {
  return (
    <div className="relative flex items-center gap-2.5">
      <span className="relative w-4 self-stretch flex items-center justify-center flex-shrink-0" aria-hidden>
        {mark}
        {!last && <span className="absolute left-1/2 -translate-x-1/2 top-[calc(50%+9px)] h-[calc(100%-12px)] w-px bg-[repeating-linear-gradient(to_bottom,var(--text-muted)_0_2px,transparent_2px_5px)]" />}
      </span>
      {children}
    </div>
  );
}
