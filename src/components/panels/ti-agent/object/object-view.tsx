'use client';
/**
 * TAKIP TI: an object's view.
 *
 * Whatever is selected, from the globe, the graph, the timeline, the table or
 * a list, opens here as an object: its type and identity, its facts, and
 * everything it is linked to, each a way on to the next object. Together they
 * make a thread a reader can follow from the prediction back to the words it
 * came from.
 */
import { ArrowLeft, LocateFixed, Network, X } from 'lucide-react';
import { Button, IconButton } from '@/components/ui/button';
import { cx } from '@/components/ui/class-names';
import { relatedLinks, type Selection } from '@/lib/oi/research';
import type { RunState } from '@/lib/oi/state';
import { TypeIcon, accentFor } from '@/components/panels/ti-agent/atoms';
import { Props } from './parts';
import type { DescribeCtx, Described } from './describe';
import { describeActor, describeEvent, describeLink, describeWorld } from './describe-run';
import { describeReport, describeScenario, describeSignpost, describeSource } from './describe-sources';
import { ScrollBody } from '@/components/panels/ti-agent/parts/scroll-body';

export interface ObjectViewProps {
  s: RunState;
  sel: Selection;
  onSelect: (key: string | null) => void;
  onLocate: (lat: number, lng: number, zoom?: number) => void;
  onAsk: (actorId: string) => void;
  /** Open the selection in the graph view, where the workspace has one. */
  onGraph?: () => void;
  /** 'panel' fills a workspace column; 'card' sits inline in the docked panel. */
  variant?: 'panel' | 'card';
  /** Back to whatever the column showed before (the workspace's lists). */
  onBack?: () => void;
}

function describe(sel: Selection, ctx: DescribeCtx): Described {
  switch (sel.type) {
    case 'link': return describeLink(sel, ctx);
    case 'actor': return describeActor(sel, ctx);
    case 'event': return describeEvent(sel, ctx);
    case 'world': return describeWorld(sel, ctx);
    case 'context': return describeSource(sel, ctx);
    case 'scenario': return describeScenario(sel, ctx);
    case 'report': return describeReport(sel, ctx);
    case 'signpost': return describeSignpost(sel, ctx);
  }
}

export function ObjectView({ s, sel, onSelect, onLocate, onAsk, onGraph, variant = 'card', onBack }: ObjectViewProps) {
  const d = describe(sel, { s, onSelect, onAsk });
  const lit = relatedLinks(s, sel.key).size;
  const actions = (
    <>
      {d.locate && <IconButton size="sm" label="Show on the map" icon={LocateFixed} onClick={() => onLocate(d.locate!.lat, d.locate!.lng, d.locate!.zoom)} />}
      {onGraph && d.inGraph && <IconButton size="sm" label="Show in the graph" icon={Network} onClick={onGraph} />}
      {variant === 'card' && <IconButton size="sm" label="Close" icon={X} onClick={() => onSelect(null)} />}
    </>
  );
  const meta = [d.type, d.subtype, lit > 1 ? `${lit} links` : ''].filter(Boolean).join(' · ');
  const content = (
    <div className="flex flex-col gap-5">
      <div className="flex items-start gap-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-card bg-surface-2">
          <TypeIcon k={sel.key} subtype={d.iconSub} link={d.iconLink} className={cx('size-4', d.iconLink ? 'text-ink-2' : accentFor(sel.key))} />
        </span>
        <div className="min-w-0 flex-1">
          <h4 className="text-title font-semibold break-words text-ink-1">{d.title}</h4>
          <p className="mt-0.5 text-meta text-ink-3 first-letter:uppercase">{meta}</p>
        </div>
        {variant === 'card' && <div className="-mt-0.5 -mr-1.5 flex shrink-0 items-center">{actions}</div>}
      </div>
      <Props rows={d.props} />
      {d.body}
    </div>
  );

  if (variant === 'panel') {
    return (
      <div className="flex h-full min-h-0 flex-col" aria-label={`${d.type}: ${typeof d.title === 'string' ? d.title : ''}`}>
        <div className="flex h-12 shrink-0 items-center gap-1 px-2">
          {onBack && <Button variant="ghost" size="sm" icon={ArrowLeft} onClick={onBack}>Back to lists</Button>}
          <span className="ml-auto flex items-center gap-0.5">{actions}</span>
        </div>
        <ScrollBody className="pt-1">{content}</ScrollBody>
      </div>
    );
  }

  // In a column or the phone drawer a new selection can sit below the fold: bring it into view.
  const bringIntoView = (el: HTMLElement | null) => {
    if (!el || el.dataset.key === sel.key) return;
    el.dataset.key = sel.key;
    el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  };
  return <section ref={bringIntoView} className="rounded-card border border-line-strong p-4">{content}</section>;
}
