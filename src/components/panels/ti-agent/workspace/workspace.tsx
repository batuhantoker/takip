'use client';
/**
 * TAKIP TI: the workspace.
 *
 * Full screen, with or without a forecast:
 *   - the top bar: the run (or TI itself), its progress, the stage switch,
 *     the object search, the model and key, and the run's controls;
 *   - on the left, the same Assist / Forecast tabs as the docked panel:
 *     Forecast is the ask form until there is a run, then the prediction with
 *     the report or the execution trace; Assist is the conversation, and TI
 *     can drive this whole workspace from it;
 *   - in the middle, the stage: the live globe, or for a run its research
 *     graph, the timeline of its simulated worlds, or the object tables;
 *   - on the right, once there is a run, whatever object is selected, or the
 *     simulation feed, the actors, the research and the questions.
 *
 * Keys: 1–4 switch the stage, Ctrl+K (⌘K) or / searches the run, Escape
 * closes the selected object and then the workspace.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Check, GanttChart, Globe2, Link2, Minimize2, Network, Plus, Table2 } from 'lucide-react';
import { Button, IconButton } from '@/components/ui/button';
import { cx } from '@/components/ui/class-names';
import ErrorBoundary from '@/components/ui/error-boundary';
import { Segmented } from '@/components/ui/segmented';
import { Dot } from '@/components/ui/tag';
import { useEscape } from '@/components/ui/use-escape';
import type { AiClient } from '@/components/panels/ti-agent/use-ai';
import { workspaceLayout } from '@/lib/ai/workspace/layout';
import { resolve } from '@/lib/ai/workspace/selection';
import type { RunState } from '@/lib/ai/state';
import { progressOf, traceOf } from '@/lib/ai/workspace/trace';
import { KIND_LABEL } from '@/components/panels/ti-agent/theme';
import { AiMark } from '@/components/panels/ti-agent/atoms';
import type { AiMode } from '@/components/panels/ti-agent/ti-mode';
import { Controls, InjectBox, UsageLine, Verdict } from '@/components/panels/ti-agent/run/run';
import { ReportBody } from '@/components/panels/ti-agent/run/report';
import { ContextList, Legend } from '@/components/panels/ti-agent/run/research-list';
import { ObjectView } from '@/components/panels/ti-agent/object/object-view';
import { TraceView } from './trace-view';
import { GraphView } from './graph-view';
import { TimelineView } from './timeline-view';
import { TableView } from './table-view';
import { ObjectSearch, type ObjectSearchHandle } from '@/components/panels/ti-agent/object/object-search';
import { ScrollBody } from '@/components/panels/ti-agent/parts/scroll-body';

export type Stage = 'globe' | 'graph' | 'timeline' | 'table';
export const STAGES: Stage[] = ['globe', 'graph', 'timeline', 'table'];
export type WorkspaceMode = AiMode;

export interface WorkspaceProps {
  /** The forecast, or null before there is one. */
  s: RunState | null;
  ai: AiClient;
  selected: string | null;
  onSelect: (key: string | null) => void;
  onLocate: (lat: number, lng: number, zoom?: number) => void;
  onAsk: (agentId: string) => void;
  onTheater?: (on: boolean) => void;
  focus?: boolean;
  onFocus?: () => void;
  following?: boolean;
  onFollow?: () => void;
  /** Forecast or Assist, shared with the docked panel. */
  mode: WorkspaceMode;
  onMode: (m: WorkspaceMode) => void;
  /** What the stage shows, which TI can change from the conversation. */
  stage: Stage;
  onStage: (s: Stage) => void;
  /** The simulation, actors, research and questions for a run, built by the panel so they share its tab state. */
  lists: ReactNode;
  errorBox: ReactNode;
  /** The conversation. */
  assistView: ReactNode;
  /** The ask form and past forecasts, for before there is a run. */
  askView: ReactNode;
  /** The model and key menu. */
  engineMenu: ReactNode;
  /** Saved chats and New conversation, shown in Assist mode. */
  assistActions?: ReactNode;
  onNewForecast: () => void;
  /** Whether TI is in the middle of a reply, for the mark in the top bar. */
  assistBusy?: boolean;
}

const SURFACE = 'pointer-events-auto absolute flex flex-col overflow-hidden rounded-float border border-line bg-surface-1 shadow-float';

function useWindowWidth(): number {
  const [w, setW] = useState(() => (typeof window === 'undefined' ? 1440 : window.innerWidth));
  useEffect(() => {
    const on = () => setW(window.innerWidth);
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  return w;
}

const stageOptions = (hasRun: boolean) => [
  { value: 'globe' as Stage, label: 'Globe', icon: Globe2 },
  { value: 'graph' as Stage, label: 'Graph', icon: Network, disabled: !hasRun },
  { value: 'timeline' as Stage, label: 'Timeline', icon: GanttChart, disabled: !hasRun },
  { value: 'table' as Stage, label: 'Table', icon: Table2, disabled: !hasRun },
];

function runStatus(s: RunState): string {
  if (s.status === 'running') return s.phaseLabel || 'Starting';
  if (s.status === 'done') return 'Prediction ready';
  if (s.status === 'failed') return s.message || 'Failed';
  return 'Stopped';
}

export function Workspace(p: WorkspaceProps) {
  const { s, ai, selected, onSelect, stage, onStage, onTheater } = p;
  const [leftTab, setLeftTab] = useState<'assessment' | 'trace' | null>(null);
  const [copied, setCopied] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const search = useRef<ObjectSearchHandle>(null);
  const L = workspaceLayout(useWindowWidth());
  const selection = s ? resolve(s, selected) : null;
  const progress = useMemo(() => (s ? progressOf(traceOf(s)) : 0), [s]);
  // Until someone picks: the trace while the run works, the assessment once there is a report.
  const left = leftTab ?? (s?.report ? 'assessment' : 'trace');
  // Without a run the graph, timeline and tables have nothing to show: the stage is the globe.
  const shown: Stage = s ? stage : 'globe';
  const hasRun = Boolean(s);
  const live = s?.status === 'running' || p.assistBusy;

  useEscape(() => { if (selected) onSelect(null); else onTheater?.(false); }, true, root);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const typing = Boolean(t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable));
      if (hasRun && ((e.key.toLowerCase() === 'k' && (e.ctrlKey || e.metaKey)) || (e.key === '/' && !typing))) {
        e.preventDefault();
        search.current?.focus();
        return;
      }
      if (typing || e.ctrlKey || e.metaKey || e.altKey) return;
      const n = Number(e.key);
      if (n >= 1 && n <= STAGES.length && (hasRun || n === 1)) onStage(STAGES[n - 1]);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onStage, hasRun]);

  const share = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/?ai=${ai.runId}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* clipboard blocked */ }
  };

  const right = s ? L.right + L.gap * 2 : L.gap;
  const stageBox = { left: L.left + L.gap * 2, right, top: L.top, bottom: L.gap };

  return (
    <div ref={root} className="pointer-events-none fixed inset-0 z-[900]" role="dialog" aria-label="TI workspace">
      {/* ── Top bar ── */}
      <header className={cx(SURFACE, 'flex-row items-center gap-3 overflow-visible px-3')} style={{ left: L.gap, right: L.gap, top: L.gap, height: 56 }}>
        <div className="flex shrink-0 items-center gap-2 pl-1">
          <AiMark size={18} live={live} />
          <span className="text-title font-semibold text-ink-1">TI</span>
        </div>
        <span aria-hidden className="h-7 w-px bg-line" />
        <div className="min-w-0 flex-1">
          {s ? (
            <>
              <p className="truncate text-body font-medium text-ink-1" title={s.question}>{s.question}</p>
              <p className="flex min-w-0 items-center gap-1.5 text-meta text-ink-3">
                {s.frame && <span className="shrink-0">{KIND_LABEL[s.frame.kind]}</span>}
                {ai.runId && <span className="shrink-0">· run <span className="font-mono">{ai.runId.slice(0, 6)}</span> ·</span>}
                <Dot tone={s.status === 'failed' ? 'red' : s.status === 'running' ? 'gold' : s.status === 'done' ? 'green' : 'muted'} pulse={s.status === 'running'} />
                <span className="truncate text-ink-2">{runStatus(s)}</span>
              </p>
            </>
          ) : (
            <>
              <p className="truncate text-body font-medium text-ink-1">Workspace</p>
              <p className="truncate text-meta text-ink-3">No forecast yet. Run one, or ask TI to work the map.</p>
            </>
          )}
        </div>
        <Segmented size="sm" label="Stage" value={shown} onChange={onStage} options={stageOptions(hasRun)} className="shrink-0" />
        {s && <div className="w-[200px] shrink-0"><ObjectSearch ref={search} s={s} onPick={k => onSelect(k)} /></div>}
        <div className="flex shrink-0 items-center gap-0.5">
          {s && <Controls s={s} ai={ai} focus={p.focus} onFocus={p.onFocus} following={p.following} onFollow={p.onFollow} />}
          {s && <Button size="sm" variant="ghost" icon={copied ? Check : Link2} onClick={share} title="Copy a link that replays this run">{copied ? 'Copied' : 'Copy link'}</Button>}
          {s && <IconButton label="New forecast" icon={Plus} onClick={p.onNewForecast} />}
          {p.mode === 'assist' && p.assistActions}
          {p.engineMenu}
          <IconButton label="Leave full screen" kbd="Esc" icon={Minimize2} onClick={() => onTheater?.(false)} />
        </div>
        {s && s.status === 'running' && (
          <span aria-hidden className="absolute inset-x-3 bottom-0 h-px overflow-hidden bg-line">
            <span className="block h-full bg-gold transition-[width] duration-500 ease-out" style={{ width: `${progress * 100}%` }} />
          </span>
        )}
      </header>

      {/* ── Left: Assist or Forecast ── */}
      <aside className={SURFACE} style={{ left: L.gap, top: L.top, bottom: L.gap, width: L.left }} aria-label={p.mode === 'assist' ? 'Assist' : 'Forecast'}>
        <div className="shrink-0 px-4 pt-3 pb-3">
          <Segmented size="sm" full semantics="tabs" label="TI" value={p.mode} onChange={p.onMode}
            options={[{ value: 'assist', label: 'Assist' }, { value: 'forecast', label: 'Forecast' }]} />
        </div>
        {p.mode === 'assist' ? p.assistView : s ? (
          <>
            <div className="shrink-0 border-t border-line p-4">
              <Verdict key={ai.runId ?? ''} s={s} large />
              {s.status === 'running' && ai.canSteer && <div className="mt-4"><InjectBox ai={ai} s={s} /></div>}
            </div>
            <div className="shrink-0 border-t border-line px-4 pt-3">
              <Segmented size="sm" label="Show" value={left} onChange={setLeftTab} options={[
                { value: 'assessment', label: s.report ? 'Report' : 'Sources' },
                { value: 'trace', label: 'Trace' },
              ]} />
            </div>
            <ScrollBody>
              {p.errorBox}
              {left === 'trace' ? <TraceView s={s} />
                : s.report ? <ReportBody s={s} runId={ai.runId} selected={selected} onSelect={onSelect} />
                  : <ContextList s={s} selected={selected} onSelect={onSelect} />}
            </ScrollBody>
            <div className="flex min-h-11 shrink-0 items-center border-t border-line px-4"><UsageLine s={s} /></div>
          </>
        ) : p.askView}
      </aside>

      {/* ── Right: the selected object, or the run's lists ── */}
      {s && (
        <aside className={SURFACE} style={{ right: L.gap, top: L.top, bottom: L.gap, width: L.right }} aria-label={selection ? 'Object' : 'Lists'}>
          {selection
            ? <ObjectView key={selection.key} s={s} sel={selection} onSelect={onSelect} onLocate={p.onLocate} onAsk={p.onAsk} onGraph={() => onStage('graph')} variant="panel" onBack={() => onSelect(null)} />
            : p.lists}
        </aside>
      )}

      {/* ── The stage ── */}
      {s && shown !== 'globe' && (
        <div key={shown} className={cx(SURFACE, 'transition-opacity duration-150 ease-out starting:opacity-0 motion-reduce:transition-none')} style={stageBox}>
          <ErrorBoundary name={`TI ${shown}`}>
            {shown === 'graph' && <GraphView s={s} selected={selected} onSelect={onSelect} />}
            {shown === 'timeline' && <TimelineView s={s} selected={selected} onSelect={onSelect} />}
            {shown === 'table' && <TableView s={s} selected={selected} onSelect={onSelect} />}
          </ErrorBoundary>
        </div>
      )}
      {shown === 'globe' && (
        <div className="pointer-events-none absolute flex justify-center" style={{ left: stageBox.left, right: stageBox.right, bottom: L.gap + 12 }}>
          {s ? (
            <div className="pointer-events-auto"><Legend floating compact /></div>
          ) : (
            <p className="pointer-events-auto rounded-full border border-line bg-surface-1 px-4 py-2 text-small text-ink-2 shadow-float">
              Run a forecast to draw its analysis here, or ask TI to take you somewhere.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
