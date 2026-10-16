'use client';
/**
 * TAKIP TI: a run as lists: the prediction, the simulation as it happened,
 * the actors who play it, the research behind it, and a way to question
 * the actors afterwards.
 */
import { useId } from 'react';
import { Segmented, segmentId } from '@/components/ui/segmented';
import type { Engine } from '@/lib/ai/client';
import type { AiClient } from '@/components/panels/ti-agent/use-ai';
import type { RunState } from '@/lib/ai/state';
import { ReportBody } from './report';
import { SimFeed } from './sim-feed';
import { ActorsList } from './actors-list';
import { WorldList } from './research-list';
import { AskBox } from './ask-box';

export type Tab = 'report' | 'sim' | 'actors' | 'world' | 'ask';

export function RunTabs(p: {
  s: RunState; tab: Tab; setTab: (t: Tab) => void; ai: AiClient; engine: Engine; keyValue: string; ready: boolean;
  selected: string | null; onSelect: (k: string | null) => void; askTarget: string; setAskTarget: (t: string) => void; theater: boolean;
}) {
  const { s, tab, setTab } = p;
  const id = useId();
  const tabs: { value: Tab; label: string }[] = [
    ...(!p.theater && s.report ? [{ value: 'report' as Tab, label: 'Report' }] : []),
    { value: 'sim', label: 'Worlds' },
    { value: 'actors', label: 'Actors' },
    // The world model and the sources behind it: "Research", so it is not mistaken for the simulated worlds.
    { value: 'world', label: 'Research' },
    { value: 'ask', label: 'Ask' },
  ];
  const current = tabs.some(t => t.value === tab) ? tab : 'sim';
  const body = (
    <>
      {current === 'report' && s.report && <ReportBody s={s} runId={p.ai.runId} selected={p.selected} onSelect={p.onSelect} />}
      {current === 'sim' && <SimFeed s={s} selected={p.selected} onSelect={p.onSelect} />}
      {current === 'actors' && <ActorsList s={s} selected={p.selected} onSelect={p.onSelect} />}
      {current === 'world' && <WorldList s={s} selected={p.selected} onSelect={p.onSelect} />}
      {current === 'ask' && <AskBox s={s} ai={p.ai} engine={p.engine} keyValue={p.keyValue} ready={p.ready} target={p.askTarget} setTarget={p.setAskTarget} onSelect={p.onSelect} />}
    </>
  );
  // Five equal tabs truncate "Research" at 360 px; sized to their words they all fit.
  const bar = <Segmented id={id} semantics="tabs" size="sm" full label="Run" value={current} onChange={setTab} options={tabs} className="[&>button]:flex-auto" />;

  if (p.theater) {
    return (
      <div className="flex h-full min-h-0 flex-col">
        <div className="shrink-0 border-b border-line px-4 py-3">{bar}</div>
        <div role="tabpanel" aria-labelledby={segmentId(id, current)} className="styled-scrollbar min-h-0 flex-1 overflow-y-auto p-4">{body}</div>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-4">
      {bar}
      <div role="tabpanel" aria-labelledby={segmentId(id, current)}>{body}</div>
    </div>
  );
}
