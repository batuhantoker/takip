'use client';

import type { ReactNode } from 'react';
import { X, Route, Crosshair, LocateFixed } from 'lucide-react';

/** A small icon button for the panel's header and field rows. */
function IconBtn({ children, label, onClick, on, className = '' }: { children: ReactNode; label: string; onClick: () => void; /** A toggle's state; leave out for a plain button. */ on?: boolean; className?: string }) {
  return (
    <button type="button" onClick={onClick} title={label} aria-label={label} aria-pressed={on}
      className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${on ? 'text-[var(--gold-light)] bg-[rgba(var(--gold-rgb),0.12)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-heading)] hover:bg-white/[0.06]'} ${className}`}>
      {children}
    </button>
  );
}

export default function DirectionsHeader({ tracking, follow, setFollow, onFollowChange, toggleTracking, onClose }: {
  tracking: boolean;
  follow: boolean;
  setFollow: (follow: boolean) => void;
  onFollowChange?: (follow: boolean) => void;
  toggleTracking: () => void;
  onClose?: () => void;
}) {
  return (
    <header className="flex items-center gap-2.5 h-12 pl-4 pr-2 flex-shrink-0 border-b border-[var(--border-secondary)] bg-black/30">
      <span className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(var(--gold-rgb),0.12)' }}>
        <Route className="w-4 h-4 text-[var(--gold-primary)]" />
      </span>
      <h2 className="flex-1 text-[14px] font-semibold text-[var(--text-heading)]">Directions</h2>
      {tracking && (
        <span className="flex items-center gap-1.5 h-6 px-2 rounded-full text-[9.5px] font-mono tracking-[0.12em] uppercase text-[var(--gold-light)]"
          style={{ background: 'rgba(var(--gold-rgb),0.1)', boxShadow: 'inset 0 0 0 1px rgba(var(--gold-rgb),0.3)' }}>
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--gold-light)] animate-takip-pulse" /> Live
        </span>
      )}
      <IconBtn label={tracking ? 'Stop live tracking' : 'Track my location live'} onClick={toggleTracking} on={tracking}>
        <Crosshair className={`w-4 h-4 ${tracking ? 'animate-pulse' : ''}`} />
      </IconBtn>
      {tracking && (
        <IconBtn label={follow ? 'Stop following' : 'Keep the map centred on me'} on={follow}
          onClick={() => { const n = !follow; setFollow(n); onFollowChange?.(n); }}>
          <LocateFixed className="w-4 h-4" />
        </IconBtn>
      )}
      {onClose && <IconBtn label="Close directions" onClick={onClose}><X className="w-4 h-4" /></IconBtn>}
    </header>
  );
}
