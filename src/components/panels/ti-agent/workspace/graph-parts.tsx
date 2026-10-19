'use client';
/** TAKIP TI: the research graph's marks: a node and the legend. */
import type { CSSProperties, PointerEvent, ReactNode } from 'react';
import { cx, FOCUS_RING, TRANSITION } from '@/components/ui/class-names';
import { useT } from '@/components/ui/use-t';
import type { GraphNode, GraphNodeKind } from '@/lib/ai/workspace/graph';
import { T } from '@/components/panels/ti-agent/theme';
import { TypeIcon } from '@/components/panels/ti-agent/atoms';

export const NODE_COLOR: Record<GraphNodeKind, string> = { actor: T.gold, evidence: T.ink2, report: T.gold };

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

export function GraphNodeMark({ n, refFn, selected, dim, showLabel, thinking, onDown, onEnter, onLeave }: {
  n: GraphNode; refFn: (el: SVGGElement | null) => void; selected: boolean; dim: boolean; showLabel: boolean; thinking: boolean;
  onDown: (e: PointerEvent) => void; onEnter: () => void; onLeave: () => void;
}) {
  const t = useT();
  const color = NODE_COLOR[n.kind];
  const icon = n.radius * 1.05;
  const label = n.kind === 'evidence' ? clip(n.label, 36) : n.kind === 'report' ? t(n.label) : n.label;
  const ring: CSSProperties = { stroke: color, strokeWidth: n.kind === 'evidence' ? 1 : n.kind === 'report' ? 2 : 1.5 };
  return (
    <g ref={refFn} data-ai-node={n.key} style={{ cursor: 'pointer', opacity: dim ? 0.16 : 1, transition: 'opacity .2s ease-out' }}
      onPointerDown={onDown} onPointerEnter={onEnter} onPointerLeave={onLeave}>
      <g className="ai-graph-in">
        {thinking && <circle r={n.radius + 6} className="ai-graph-ping" style={{ fill: 'none', stroke: T.goldDim, strokeWidth: 1.2 }} vectorEffect="non-scaling-stroke" />}
        {selected && <circle r={n.radius + 5} className="fill-none stroke-ink-1" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />}
        {n.kind === 'report' && <circle r={n.radius + 4} style={{ fill: 'none', stroke: color, strokeWidth: 1, opacity: 0.35 }} vectorEffect="non-scaling-stroke" />}
        {/* The actors who play the simulation wear a second, quieter ring. */}
        {n.cast && <circle r={n.radius + 3.5} style={{ fill: 'none', stroke: T.goldDim, strokeWidth: 1.2 }} vectorEffect="non-scaling-stroke" />}
        <circle r={n.radius} className="fill-surface-2" style={ring} vectorEffect="non-scaling-stroke" />
        <TypeIcon k={n.key} subtype={n.subtype} x={-icon / 2} y={-icon / 2} width={icon} height={icon} strokeWidth={1.8} style={{ color, pointerEvents: 'none' }} />
        {showLabel && (
          <text y={n.radius} dy="1.3em" textAnchor="middle"
            className={cx('stroke-surface-0', n.kind === 'actor' ? (n.cast ? 'fill-ink-1' : 'fill-ink-2') : n.kind === 'report' ? 'fill-gold' : 'fill-ink-2')}
            style={{
              fontSize: `calc(${n.kind === 'evidence' ? 11 : 12}px * var(--ls, 1))`,
              fontWeight: n.kind === 'evidence' ? 400 : 500,
              strokeWidth: 3, paintOrder: 'stroke', strokeLinejoin: 'round', pointerEvents: 'none',
            }}>
            {label}
          </text>
        )}
      </g>
    </g>
  );
}

/** What the edges' colours mean (the arcs' own three, from the Style Studio), and the ring the players wear. */
export function GraphLegend() {
  const t = useT();
  const line = (label: string, color: string, dash?: string) => (
    <span className="inline-flex items-center gap-1.5">
      <svg width="16" height="6" aria-hidden><line x1="1" x2="15" y1="3" y2="3" strokeWidth="2" strokeDasharray={dash} strokeLinecap="round" style={{ stroke: color }} /></svg>{label}
    </span>
  );
  return (
    <div className="pointer-events-none absolute bottom-3 left-3 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-card border border-line bg-surface-1 px-3 py-1.5 text-meta text-ink-2">
      {line(t('Aligned · cooperates'), T.support)}
      {line(t('Opposed · presses'), T.oppose)}
      {line(t('Between'), T.neutral)}
      {line(t('Quote'), T.ink2, '0.5 3')}
      <span className="inline-flex items-center gap-1.5">
        <svg width="10" height="10" aria-hidden><circle cx="5" cy="5" r="4" fill="none" strokeWidth="1.2" style={{ stroke: T.goldDim }} /></svg>{t('Plays in the simulation')}
      </span>
    </div>
  );
}
