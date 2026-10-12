'use client';

import { STATUS_META, CATEGORY_COLOR, type Row, type RowStatus } from '@/lib/recon-fingerprint';

/** `live` is false once a search has ended — a hit still awaiting
 *  calibration then never got it, and must not look like work in progress. */
export function StatusPill({ status, live }: { status: RowStatus; live: boolean }) {
  const m = STATUS_META[status];
  const pending = status === 'verifying';
  return (
    <span
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold tracking-wider whitespace-nowrap"
      style={{ color: m.color, background: `${m.color}1a`, border: `1px solid ${m.color}40` }}
    >
      {pending && live && <span className="w-1 h-1 rounded-full animate-pulse" style={{ background: m.color }} />}
      {pending && !live ? 'UNVERIFIED' : m.label}
    </span>
  );
}

export function PlatformTile({ row, size = 28 }: { row: Row; size?: number }) {
  const color = CATEGORY_COLOR[row.category];
  return (
    <span
      className="flex items-center justify-center rounded-md font-mono font-bold flex-shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.45, color, background: `${color}1f`, border: `1px solid ${color}40` }}
    >
      {row.site.replace(/[^A-Za-z0-9]/g, '').charAt(0).toUpperCase() || '?'}
    </span>
  );
}

export function Toggle({ on, label, count, color, onClick }: { on: boolean; label: string; count: number; color: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-mono transition-colors"
      style={{ color: on ? color : 'var(--text-muted)', background: on ? `${color}14` : 'transparent', border: `1px solid ${on ? `${color}55` : 'var(--border-primary)'}` }}
    >
      <span className="w-2.5 h-2.5 rounded-sm border flex items-center justify-center" style={{ borderColor: on ? color : 'var(--text-muted)' }}>
        {on && <span className="w-1.5 h-1.5 rounded-[1px]" style={{ background: color }} />}
      </span>
      {label}
      <span className="opacity-70">{count}</span>
    </button>
  );
}
