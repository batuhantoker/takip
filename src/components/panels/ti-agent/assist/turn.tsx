'use client';
/** TAKIP TI Assist: one turn of the conversation, the reader's or TI's. */
import { useState } from 'react';
import {
  AlertCircle, Cctv, Eraser, Globe2, LayoutDashboard, Layers, List, LoaderCircle, MapPin, MousePointerClick, Navigation, Orbit, PanelRight,
  RotateCcw, ScanSearch, Search, TrendingUp, type LucideIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cx } from '@/components/ui/class-names';
import { Dot } from '@/components/ui/tag';
import type { OiClient } from '@/lib/oi/client';
import type { ActionView, Entry } from '@/lib/oi/assist/client';
import type { Mode, ToolName } from '@/lib/oi/assist/protocol';
import { actionLine, flewTo, layerChange } from './action-words';
import { Prose } from './prose';
import { ResultCard, cardWorthShowing } from './result-card';

const TOOL_ICON: Record<ToolName, LucideIcon> = {
  go_to: Navigation, layers: Layers, find: Search, scan: ScanSearch, camera: Cctv, highlight: MapPin, show: List, markets: TrendingUp,
  open: PanelRight, map_view: Globe2, forecast: Orbit, workspace: LayoutDashboard, select: MousePointerClick, clear: Eraser,
};

const MODE_WORD: Record<Mode, string> = { auto: '', navigate: 'Navigate', research: 'Research', forecast: 'Forecast' };

export interface MapHands {
  onLocate: (lat: number, lng: number, zoom?: number) => void;
  /** Switch layers on and off, to take back what TI switched. */
  setLayers?: (on: string[], off: string[]) => void;
}

/** One thing TI did, with the way back or the way to look again where there is one. */
function ActionRow({ a, hands, carded }: { a: ActionView; hands: MapHands; carded: boolean }) {
  const [undone, setUndone] = useState(false);
  const at = a.tool === 'go_to' && a.status === 'ok' ? flewTo(a) : null;
  const change = a.tool === 'layers' && a.status === 'ok' ? layerChange(a) : null;
  const canUndo = Boolean(change && hands.setLayers && (change.on.length || change.off.length));
  const Icon = a.status === 'running' ? LoaderCircle : a.status === 'error' ? AlertCircle : TOOL_ICON[a.tool];
  return (
    <li className="flex min-h-7 items-center gap-2.5">
      <Icon aria-hidden strokeWidth={1.75} className={cx('size-3.5 shrink-0',
        a.status === 'running' ? 'animate-spin text-ink-2 motion-reduce:animate-none' : a.status === 'error' ? 'text-red' : a.status === 'pending' ? 'text-ink-4' : 'text-ink-3')} />
      <span className={cx('min-w-0 flex-1 text-small', a.status === 'error' ? 'text-red' : a.status === 'pending' ? 'text-ink-3' : 'text-ink-2', undone && 'line-through decoration-ink-4')}>
        {actionLine(a, carded)}
      </span>
      {at && <Button variant="ghost" size="sm" className="-my-1 -mr-2" onClick={() => hands.onLocate(at.lat, at.lng, at.zoom)}>Show</Button>}
      {canUndo && change && (
        <Button variant="ghost" size="sm" className="-my-1 -mr-2" onClick={() => {
          if (undone) hands.setLayers!(change.on, change.off); else hands.setLayers!(change.off, change.on);
          setUndone(u => !u);
        }}>
          {undone ? 'Redo' : 'Undo'}
        </Button>
      )}
    </li>
  );
}

export function Turn({ e, oi, hands, onOpenForecast, onWorkspace, onRetry }: {
  e: Entry; oi: OiClient; hands: MapHands; onOpenForecast: () => void; onWorkspace?: () => void; onRetry: (text: string, mode: Mode) => void;
}) {
  if (e.role === 'user') {
    return (
      <div className="flex max-w-[86%] flex-col items-end gap-1 self-end">
        {e.mode !== 'auto' && <span className="text-meta text-ink-3">{MODE_WORD[e.mode]}</span>}
        <p className="rounded-card bg-surface-2 px-3 py-2 text-body leading-5 whitespace-pre-wrap text-ink-1 [overflow-wrap:anywhere]">{e.text}</p>
      </div>
    );
  }
  const cards = e.cards.filter(cardWorthShowing);
  // Each card is the result of one finished action of the same name; that row then only names the act.
  const unclaimed = new Map<string, number>();
  for (const c of cards) unclaimed.set(c.kind, (unclaimed.get(c.kind) ?? 0) + 1);
  const carded = e.actions.map(a => {
    const n = a.status === 'ok' ? unclaimed.get(a.tool) ?? 0 : 0;
    if (n) unclaimed.set(a.tool, n - 1);
    return n > 0;
  });
  return (
    <div className="flex flex-col gap-3">
      {e.says.map((s, i) => <Prose key={i} text={s} />)}
      {e.actions.length > 0 && (
        <ul aria-label="What TI did" className="flex flex-col border-l border-line pl-3">
          {e.actions.map((a, i) => <ActionRow key={i} a={a} hands={hands} carded={carded[i]} />)}
        </ul>
      )}
      {cards.map((c, i) => <ResultCard key={i} card={c} oi={oi} onLocate={hands.onLocate} onOpenForecast={onOpenForecast} onWorkspace={onWorkspace} />)}
      {e.busy && !e.says.length && !e.actions.length && (
        <p role="status" className="flex items-center gap-2 text-small text-ink-3"><Dot tone="gold" pulse />Thinking</p>
      )}
      {e.error && (
        <div className="flex items-center gap-2">
          <span className="min-w-0 flex-1 text-small text-red">{e.error}</span>
          {e.retry && <Button variant="ghost" size="sm" icon={RotateCcw} className="-mr-2" onClick={() => onRetry(e.retry!.text, e.retry!.mode)}>Try again</Button>}
        </div>
      )}
    </div>
  );
}

