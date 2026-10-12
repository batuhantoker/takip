'use client';

import { motion } from 'framer-motion';
import type { LayerDef } from './layer-groups';
import { sentenceCase } from './sentence-case';

/* ── Minimal Toggle Switch ── */
/**
 * Presentational only. The row around it is the button, and a button inside a
 * button is invalid HTML — the browser reparents it, which breaks hydration and
 * silently drops the click handler on the inner control.
 */
function ToggleSwitch({ active, small }: { active: boolean; small?: boolean }) {
  const [w, h, knob] = small ? [24, 14, 10] : [28, 16, 12];
  return (
    <span
      role="presentation"
      className="relative flex-shrink-0 block"
      style={{ width: w, height: h }}
    >
      <span
        className="absolute inset-0 rounded-full transition-colors duration-200"
        style={{
          background: active ? 'rgba(var(--cyan-rgb), 0.3)' : 'rgba(255,255,255,0.06)',
          border: `1px solid ${active ? 'rgba(var(--cyan-rgb), 0.6)' : 'rgba(255,255,255,0.22)'}`,
        }}
      />
      <motion.span
        className="absolute rounded-full"
        style={{
          top: (h - knob) / 2,
          width: knob,
          height: knob,
          background: active ? 'var(--cyan-primary)' : 'rgba(255,255,255,0.45)',
        }}
        animate={{ left: active ? w - knob - 2 : 2 }}
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
      className="pointer-events-none absolute left-[15px] top-0 h-[15px] w-[9px] rounded-bl-[3px] border-b border-l border-white/[0.18]"
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
      className="px-2 py-0.5 rounded text-[11px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/[0.07] transition-colors disabled:opacity-35 disabled:pointer-events-none focus:outline-none focus-visible:ring-1 focus-visible:ring-white/30"
    >
      {children}
    </button>
  );
}

export function LayerRow({ layer, active, count, dormant, onToggle, mobile }: {
  layer: LayerDef; active: boolean; count: number | null; dormant: boolean; onToggle: () => void; mobile?: boolean;
}) {
  const sub = !!layer.parent;
  const label = sentenceCase(layer.label);
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={active}
      aria-label={label}
      title={dormant ? 'Turn the layer above on to use this' : undefined}
      className={`relative w-full flex items-start gap-2.5 ${mobile ? 'py-2' : 'py-1.5'} rounded-md hover:bg-white/[0.05] transition-colors cursor-pointer text-left focus:outline-none focus-visible:ring-1 focus-visible:ring-white/30 ${sub ? 'pl-[30px] pr-2' : 'px-2'} ${dormant ? 'opacity-45' : ''}`}
    >
      {sub && <SubLayerStem />}
      <span className={`flex items-center ${sub ? 'h-[18px]' : 'h-5'}`}>
        <ToggleSwitch active={active} small={sub} />
      </span>
      <span className="flex-1 min-w-0">
        <span className={`block transition-colors duration-200 ${sub ? 'text-[12px] leading-[18px]' : 'text-[13px] leading-5'} ${active ? 'text-[var(--text-primary)]' : 'text-white/70'}`}>
          {label}
        </span>
        {layer.description && <span className="block mt-0.5 text-[11px] leading-4 text-[var(--text-secondary)] opacity-80">{layer.description}</span>}
      </span>
      {count !== null && (
        <span className={`${sub ? 'leading-[18px]' : 'leading-5'} text-[11px] font-mono tabular-nums transition-colors ${active ? 'text-white/75' : 'text-white/35'}`}>
          {count.toLocaleString()}
        </span>
      )}
    </button>
  );
}
