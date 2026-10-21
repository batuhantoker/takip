'use client';

import { useState } from 'react';

export type FlowNode = { id: string; label: string; color?: string };
export type FlowColumn = { title: string; nodes: FlowNode[] };
/** `source` and `target` are node ids in neighbouring columns. */
export type FlowLink = { source: string; target: string; value: number; color?: string };

const W = 960;
const PAD_L = 180;
const PAD_R = 160;
const BAR = 10;
const GAP = 12;
const HEAD = 22;
const MAX_LABEL = 28;

const clip = (s: string) => (s.length > MAX_LABEL ? `${s.slice(0, MAX_LABEL - 1)}…` : s);

type Placed = FlowNode & { col: number; x: number; y: number; h: number; value: number };
type Band = FlowLink & { sy: number; ty: number; h: number; x0: number; x1: number };

function layout(columns: FlowColumn[], links: FlowLink[]) {
  const inflow = new Map<string, number>();
  const outflow = new Map<string, number>();
  for (const l of links) {
    outflow.set(l.source, (outflow.get(l.source) ?? 0) + l.value);
    inflow.set(l.target, (inflow.get(l.target) ?? 0) + l.value);
  }
  const valued = columns.map(c => c.nodes.map(n => ({ ...n, value: Math.max(inflow.get(n.id) ?? 0, outflow.get(n.id) ?? 0) })).filter(n => n.value > 0));
  const most = Math.max(1, ...valued.map(c => c.length));
  const height = Math.max(180, most * 30);
  const scale = Math.min(...valued.map(c => (height - GAP * (c.length - 1)) / Math.max(1, c.reduce((s, n) => s + n.value, 0))));
  const step = (W - PAD_L - PAD_R - BAR) / Math.max(1, columns.length - 1);

  const nodes = new Map<string, Placed>();
  valued.forEach((col, i) => {
    const used = col.reduce((s, n) => s + n.value * scale, 0) + GAP * (col.length - 1);
    let y = HEAD + (height - used) / 2;
    for (const n of col) {
      const h = Math.max(1.5, n.value * scale);
      nodes.set(n.id, { ...n, col: i, x: PAD_L + i * step, y, h });
      y += n.value * scale + GAP;
    }
  });

  // Bands leave and enter each node in the order of the node at their other end, so they never cross at a node.
  const out = new Map<string, number>();
  const into = new Map<string, number>();
  const bands: Band[] = [];
  const sorted = links.filter(l => nodes.has(l.source) && nodes.has(l.target) && l.value > 0)
    .sort((a, b) => nodes.get(a.source)!.y - nodes.get(b.source)!.y || nodes.get(a.target)!.y - nodes.get(b.target)!.y);
  for (const l of sorted) {
    const s = nodes.get(l.source)!;
    const t = nodes.get(l.target)!;
    const h = l.value * scale;
    const sy = s.y + (out.get(l.source) ?? 0);
    out.set(l.source, (out.get(l.source) ?? 0) + h);
    bands.push({ ...l, sy, ty: 0, h, x0: s.x + BAR, x1: t.x });
  }
  for (const b of [...bands].sort((a, c) => nodes.get(a.target)!.y - nodes.get(c.target)!.y || nodes.get(a.source)!.y - nodes.get(c.source)!.y)) {
    const t = nodes.get(b.target)!;
    b.ty = t.y + (into.get(b.target) ?? 0);
    into.set(b.target, (into.get(b.target) ?? 0) + b.h);
  }
  return { nodes: [...nodes.values()], bands, height: height + HEAD + 4, step };
}

const bandPath = ({ x0, x1, sy, ty, h }: Band) => {
  const xm = (x0 + x1) / 2;
  return `M${x0},${sy}C${xm},${sy} ${xm},${ty} ${x1},${ty}L${x1},${ty + h}C${xm},${ty + h} ${xm},${sy + h} ${x0},${sy + h}Z`;
};

/**
 * Columns of nodes joined by bands as wide as what flows between them (a Sankey). The first column is labelled on its
 * left, the rest on their right. Pointing at a node or band names it in the line above; clicking a node picks it.
 */
export function FlowChart({ columns, links, label, format, onPick }: {
  columns: FlowColumn[]; links: FlowLink[]; label: string; format: (n: number) => string; onPick?: (column: number, id: string) => void;
}) {
  const [hover, setHover] = useState<{ node?: string; band?: number } | null>(null);
  const { nodes, bands, height, step } = layout(columns, links);
  const byId = new Map(nodes.map(n => [n.id, n]));
  const lit = (b: Band, i: number) => !hover || hover.band === i || (hover.node !== undefined && (b.source === hover.node || b.target === hover.node));

  const focusNode = hover?.node ? byId.get(hover.node) : undefined;
  const focusBand = hover?.band !== undefined ? bands[hover.band] : undefined;
  const readout = focusNode
    ? `${focusNode.label}: ${format(focusNode.value)}`
    : focusBand
      ? `${byId.get(focusBand.source)?.label} → ${byId.get(focusBand.target)?.label}: ${format(focusBand.value)}`
      : onPick ? 'Point at a band or node for its count; click a node to list its visits below.' : '';

  return (
    <div className="flex flex-col gap-2">
      <p className="min-h-4 text-[12px] text-ink-2" aria-live="polite">{readout}</p>
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${W} ${height}`} role="img" aria-label={label} className="h-auto w-full min-w-[640px]" onPointerLeave={() => setHover(null)}>
          {columns.map((c, i) => (
            <text key={c.title} x={PAD_L + i * step + (i === 0 ? BAR : 0)} y={12} textAnchor={i === 0 ? 'end' : 'start'} className="fill-ink-3 text-[11px]">{c.title}</text>
          ))}
          {bands.map((b, i) => (
            <path key={`${b.source}>${b.target}`} d={bandPath(b)} fill={b.color ?? 'var(--ink-3)'} fillOpacity={lit(b, i) ? (hover ? 0.6 : 0.32) : 0.07}
              onPointerEnter={() => setHover({ band: i })} />
          ))}
          {nodes.map(n => {
            const left = n.col === 0;
            const tx = left ? n.x - 6 : n.x + BAR + 6;
            return (
              <g key={n.id} onPointerEnter={() => setHover({ node: n.id })} onClick={onPick ? () => onPick(n.col, n.id) : undefined}
                className={onPick ? 'cursor-pointer' : undefined}>
                <rect x={n.x} y={n.y} width={BAR} height={n.h} rx={2} fill={n.color ?? 'var(--ink-2)'} />
                <rect x={left ? n.x - PAD_L + 10 : n.x} y={n.y - 4} width={left ? PAD_L - 10 + BAR : 130} height={Math.max(n.h, 16) + 8} fill="transparent" />
                <text x={tx} y={n.y + n.h / 2} dy="0.35em" textAnchor={left ? 'end' : 'start'} paintOrder="stroke" stroke="var(--surface-1)" strokeWidth={4}
                  className={`text-[12px] ${hover?.node === n.id ? 'fill-ink-1 font-medium' : 'fill-ink-1'}`}>
                  <title>{n.label}</title>
                  {clip(n.label)}
                  <tspan className="fill-ink-3 font-mono text-[11px]">{` ${format(n.value)}`}</tspan>
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
