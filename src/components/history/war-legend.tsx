'use client';

import { X } from 'lucide-react';
import type { HistorySession } from '@/lib/history/session';
import { ALIGNMENTS, WAR_LAYERS } from '@/lib/history/war-layers';

const HATCH = 'repeating-linear-gradient(135deg, rgba(230,103,103,0.85) 0 1px, transparent 1px 4px)';

/** Above the History bar while wartime borders are on: what the colours mean and where the borders come from. */
export default function WarLegend({ session }: { session: HistorySession }) {
  const layers = WAR_LAYERS.filter(l => session.layers().includes(l.code));
  if (!layers.length) return null;
  return (
    <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-[380px] max-w-[calc(100vw-32px)] px-3 py-2.5 rounded-lg bg-[var(--bg-panel)] border border-white/[0.08] backdrop-blur-xl shadow-lg font-sans text-[var(--text-secondary)]">
      <div className="flex items-start gap-2 mb-2">
        <h3 className="flex-1 text-[12px] font-medium text-[var(--text-primary)] leading-snug">{layers.map(l => l.label).join(', ')}</h3>
        <button type="button" aria-label="Hide wartime borders" onClick={() => layers.forEach(l => session.setLayer(l.code, false))}
          className="w-5 h-5 -mr-1 rounded flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--hover-accent)]">
          <X className="w-3.5 h-3.5" strokeWidth={1.5} />
        </button>
      </div>
      <ul className="flex flex-wrap gap-x-3 gap-y-1">
        {ALIGNMENTS.map(a => (
          <li key={a.key} className="flex items-center gap-1.5 text-[11px] text-[var(--text-primary)]">
            <span className="w-3.5 h-2.5 rounded-sm border border-white/10" style={{ background: a.key === 'occupied' ? `${HATCH}, ${a.color}` : a.color }} />
            {a.label}
          </li>
        ))}
      </ul>
      {layers.map(l => <p key={l.code} className="mt-2 text-[10px] text-[var(--text-muted)]">{l.note} Stanford Spatial History Lab, non-commercial use.</p>)}
    </div>
  );
}
