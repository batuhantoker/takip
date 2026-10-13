'use client';
/** TAKIP TI: the research graph's chrome: its title and filters on the left, the view tools on the right, the hover card. */
import type { ReactNode, Ref } from 'react';
import { Filter, Focus, Maximize, Minus, Plus, Type } from 'lucide-react';
import { IconButton } from '@/components/ui/button';
import { cx, FOCUS_RING, TRANSITION } from '@/components/ui/class-names';
import { Segmented } from '@/components/ui/segmented';
import type { GraphNodeKind, LayoutMode } from '@/lib/oi/graph';
import { LINK_LABEL } from '@/lib/oi/objects';
import type { LinkKind } from '@/lib/oi/types';
import { T } from '@/components/panels/ti-agent/theme';
import { TypeIcon } from '@/components/panels/ti-agent/atoms';
import { NODE_COLOR } from './graph-parts';

export const FILTER_W = 196;

const NODE_LABEL: Record<GraphNodeKind, string> = { actor: 'Actors', evidence: 'Sources', report: 'Report' };
const LINK_FILTER_LABEL: Record<LinkKind, string> = { relation: 'Relations', evidence: 'Evidence', move: 'Moves', cite: 'Quotes' };

function FilterGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="px-1.5 pb-0.5 text-meta font-medium text-ink-3">{label}</span>
      {children}
    </div>
  );
}

function FilterRow({ on, count, onClick, mark, children }: { on: boolean; count: number; onClick: () => void; mark: ReactNode; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={on} disabled={count === 0}
      className={cx('flex h-7 items-center gap-2 rounded-control px-1.5 text-left text-small hover:bg-surface-2 disabled:pointer-events-none disabled:opacity-40',
        on ? 'text-ink-1' : 'text-ink-3', FOCUS_RING, TRANSITION)}>
      <span className={cx('flex w-3.5 items-center justify-center', !on && 'opacity-40')}>{mark}</span>
      <span className={cx('flex-1 truncate', !on && 'line-through decoration-ink-4')}>{children}</span>
      <span className="font-mono text-meta text-ink-3 tabular-nums">{count}</span>
    </button>
  );
}

/** The title, what is on screen, and the node, link and layout filters under it. */
export function GraphFilters(p: {
  nodes: number; links: number; isolating: boolean; open: boolean;
  nodeCounts: Record<GraphNodeKind, number>; edgeCounts: Record<LinkKind, number>;
  hideNodes: ReadonlySet<GraphNodeKind>; hideEdges: ReadonlySet<LinkKind>;
  onNode: (k: GraphNodeKind) => void; onEdge: (k: LinkKind) => void;
  mode: LayoutMode; onMode: (m: LayoutMode) => void;
}) {
  return (
    <div className="absolute top-3 left-3 flex flex-col gap-2" style={{ width: FILTER_W - 16 }}>
      <div className="pointer-events-none px-1">
        <h3 className="text-body font-semibold text-ink-1">Research graph</h3>
        <p className="mt-0.5 text-meta text-ink-3">
          <span className="font-mono tabular-nums">{p.nodes}</span> nodes · <span className="font-mono tabular-nums">{p.links}</span> links{p.isolating ? ' · isolated' : ''}
        </p>
      </div>
      {p.open && (
        <div className="flex flex-col gap-3 rounded-card border border-line bg-surface-1 p-2 shadow-float">
          <FilterGroup label="Nodes">
            {(Object.keys(NODE_LABEL) as GraphNodeKind[]).map(k => (
              <FilterRow key={k} on={!p.hideNodes.has(k)} count={p.nodeCounts[k]} onClick={() => p.onNode(k)}
                mark={<TypeIcon k={k === 'actor' ? 'a:' : k === 'report' ? 'r:' : 'c:'} subtype={k === 'actor' ? 'state' : 'news'} className="size-3.5" style={{ color: NODE_COLOR[k] }} />}>
                {NODE_LABEL[k]}
              </FilterRow>
            ))}
          </FilterGroup>
          <FilterGroup label="Links">
            {(Object.keys(LINK_LABEL) as LinkKind[]).map(k => (
              <FilterRow key={k} on={!p.hideEdges.has(k)} count={p.edgeCounts[k]} onClick={() => p.onEdge(k)}
                mark={<svg width="14" height="6" aria-hidden><line x1="1" x2="13" y1="3" y2="3" strokeWidth="2" strokeLinecap="round" strokeDasharray={k === 'cite' ? '0.5 3' : undefined} style={{ stroke: k === 'evidence' || k === 'cite' ? T.ink2 : T.neutral }} /></svg>}>
                {LINK_FILTER_LABEL[k]}
              </FilterRow>
            ))}
          </FilterGroup>
          <FilterGroup label="Layout">
            <Segmented size="sm" full label="Layout" value={p.mode} onChange={p.onMode} options={[
              { value: 'force', label: 'Free' },
              { value: 'flow', label: 'Flow' },
            ]} />
          </FilterGroup>
        </div>
      )}
    </div>
  );
}

/** Isolate, labels, zoom, fit and the filters' switch. */
export function GraphToolbar(p: {
  canIsolate: boolean; isolating: boolean; onIsolate: () => void;
  labels: boolean; onLabels: () => void;
  onZoom: (factor: number) => void;
  fitted: boolean; onFit: () => void;
  filters: boolean; hidden: number; onFilters: () => void;
}) {
  return (
    <div className="absolute top-3 right-3 flex items-center gap-0.5 rounded-card border border-line bg-surface-1 p-0.5 shadow-float">
      <IconButton size="sm" icon={Focus} active={p.isolating} disabled={!p.canIsolate} onClick={p.onIsolate}
        label={p.canIsolate ? 'Show only the selection and what it touches' : 'Select something to isolate it'} />
      <IconButton size="sm" icon={Type} active={p.labels} onClick={p.onLabels} label="Show every link's label" />
      <span className="mx-0.5 h-4 w-px bg-line" />
      <IconButton size="sm" icon={Minus} onClick={() => p.onZoom(1 / 1.3)} label="Zoom out" />
      <IconButton size="sm" icon={Plus} onClick={() => p.onZoom(1.3)} label="Zoom in" />
      <IconButton size="sm" icon={Maximize} active={p.fitted} onClick={p.onFit} label="Fit the whole graph and follow it as it grows" />
      <span className="mx-0.5 h-4 w-px bg-line" />
      <IconButton size="sm" icon={Filter} active={p.filters} onClick={p.onFilters} label={`${p.filters ? 'Hide' : 'Show'} the filters${p.hidden ? ` · ${p.hidden} hidden` : ''}`} />
    </div>
  );
}

/** What is under the pointer; the graph moves it with the pointer, so it is always mounted. */
export function GraphTip({ tipRef, brief }: { tipRef: Ref<HTMLDivElement>; brief: { title: string; detail?: string } | null }) {
  return (
    <div ref={tipRef} role="tooltip" className="pointer-events-none absolute max-w-[270px] rounded-float border border-line bg-surface-1 px-3 py-2 shadow-float"
      style={{ opacity: brief ? 1 : 0, transition: 'opacity .15s ease-out' }}>
      {brief && (
        <>
          <div className="text-small font-medium text-ink-1">{brief.title}</div>
          {brief.detail && <div className="mt-0.5 text-meta text-ink-2">{brief.detail}</div>}
          <div className="mt-1 text-meta text-ink-3">Click to open</div>
        </>
      )}
    </div>
  );
}
