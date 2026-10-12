'use client';

import { motion } from 'framer-motion';
import type { LayerDef } from './layer-groups';

/* ── Minimal Toggle Switch ── */
/**
 * Presentational only. The row around it is the button, and a button inside a
 * button is invalid HTML — the browser reparents it, which breaks hydration and
 * silently drops the click handler on the inner control.
 */
function ToggleSwitch({ active }: { active: boolean }) {
  return (
    <span
      role="presentation"
      className="relative flex-shrink-0 block"
      style={{ width: 28, height: 14 }}
    >
      <div
        className="absolute inset-0 rounded-full transition-all duration-300"
        style={{
          background: active ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.04)',
          border: active ? '1px solid rgba(255,255,255,0.45)' : '1px solid rgba(255,255,255,0.28)',
          boxShadow: active ? '0 0 8px rgba(255,255,255,0.1)' : 'none',
        }}
      />
      <motion.div
        className="absolute top-[2px] rounded-full"
        style={{
          width: 10,
          height: 10,
          background: active ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.4)',
          boxShadow: active ? '0 0 6px rgba(255,255,255,0.4)' : 'none',
        }}
        animate={{ left: active ? 16 : 2 }}
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      />
    </span>
  );
}

/**
 * The elbow that ties a sub-layer row to the layer above it. Indentation alone
 * reads as a typo at this size; the line is what says "this belongs to that".
 */
function SubLayerStem() {
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute left-[6px] top-0 h-1/2 w-[8px] rounded-bl-[3px] border-b border-l border-white/[0.25]"
    />
  );
}

export function BulkButton({ onClick, disabled, children, label }: { onClick: () => void; disabled?: boolean; children: React.ReactNode; label: string }) {
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      disabled={disabled}
      aria-label={label}
      className="px-1.5 py-0.5 rounded text-[10px] font-mono tracking-wider text-white/70 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-35 disabled:pointer-events-none focus:outline-none focus-visible:ring-1 focus-visible:ring-white/30"
    >
      {children}
    </button>
  );
}

export function LayerRow({ layer, active, count, dormant, onToggle, mobile }: {
  layer: LayerDef; active: boolean; count: number | null; dormant: boolean; onToggle: () => void; mobile?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={active}
      aria-label={layer.label}
      title={dormant ? 'Turn the layer above on to use this' : undefined}
      className={`relative w-full flex items-center gap-3 ${mobile ? 'py-2' : 'py-1'} rounded-md hover:bg-white/[0.06] transition-colors cursor-pointer text-left focus:outline-none focus-visible:ring-1 focus-visible:ring-white/30 ${layer.parent ? 'pl-[22px] pr-1' : 'px-1'} ${dormant ? 'opacity-50' : ''}`}
    >
      {layer.parent && <SubLayerStem />}
      <ToggleSwitch active={active} />
      <span className={`text-[11px] font-mono uppercase tracking-wider flex-1 transition-colors duration-200 ${active ? 'text-white' : 'text-white/65'}`}>
        {layer.label}
        {layer.description && <span className="block mt-0.5 text-[9px] normal-case tracking-normal text-white/55">{layer.description}</span>}
      </span>
      {count !== null && (
        <span className={`text-[10px] font-mono tabular-nums transition-colors ${active ? 'text-white/75' : 'text-white/45'}`}>
          {count.toLocaleString()}
        </span>
      )}
    </button>
  );
}
