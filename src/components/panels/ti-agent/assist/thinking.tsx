'use client';
/**
 * TAKIP TI Assist: what TI is thinking while it works. The model's reasoning streams in as it writes it
 * (where the model shows any), then the reply forming and the tools it is about to use; afterwards the
 * reasoning folds away under the turn.
 */
import { useEffect, useRef, useState } from 'react';
import { Brain, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cx } from '@/components/ui/class-names';
import { Dot } from '@/components/ui/tag';
import { useT } from '@/components/ui/use-t';
import { msg } from '@/lib/core/i18n/translator';
import { sayInProgress, toolsInProgress, type ToolName } from '@/lib/ai/assist/protocol';

/** What each tool does, as it reads after "About to". */
const TOOL_WORD: Record<ToolName, string> = {
  go_to: msg('fly the map'), move: msg('move the camera'), layers: msg('switch layers'), find: msg('search live data'), scan: msg('look at what is here'),
  track: msg('track an aircraft, ship or satellite'), untrack: msg('stop tracking'), aircraft: msg('look up one aircraft'), weather: msg('check the weather at a place'),
  pass: msg('work out satellite passes'), brief: msg('read the situation at a place'), route: msg('route between places'), nearby: msg('find mapped places near a point'),
  camera: msg('look through a camera'), highlight: msg('mark the map'), show: msg('show a card'), markets: msg('read market quotes'), open: msg('open or close a panel'),
  map_view: msg('change the map projection and basemap'), timeline: msg('open Replay or History'), chronicle: msg('read what happened here, then'),
  past_event: msg('look up one event from the historical record'), link: msg('make a link in TAKIP'), forecast: msg('start a forecast'),
  workspace: msg('open the TI workspace'), select: msg('open a forecast object'), clear: msg('clear the marks'),
};

/** A box of reasoning that keeps its newest line in view while it grows. */
function ReasoningText({ text, live }: { text: string; live?: boolean }) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (live && box.current) box.current.scrollTop = box.current.scrollHeight;
  }, [text, live]);
  return (
    <div ref={box} className={cx('overflow-y-auto border-l border-line pl-3 text-small leading-5 whitespace-pre-wrap text-ink-3 [overflow-wrap:anywhere]', live ? 'max-h-32' : 'max-h-64')}>
      {text}
    </div>
  );
}

/** The step being written: its reasoning, the reply as it forms, the tools it names. */
export function LiveThinking({ live }: { live: { reasoning: string; text: string } }) {
  const t = useT();
  const say = sayInProgress(live.text);
  const tools = toolsInProgress(live.text);
  const word = say || tools.length ? t('Answering') : live.reasoning ? t('Thinking it through') : t('Thinking');
  return (
    <div role="status" className="flex flex-col gap-1.5">
      <p className="flex items-center gap-2 text-small text-ink-3"><Dot tone="gold" pulse />{word}</p>
      {live.reasoning && <ReasoningText text={live.reasoning} live />}
      {say && <p className="text-body leading-5 whitespace-pre-wrap text-ink-2">{say}</p>}
      {tools.length > 0 && <p className="text-meta text-ink-3">{t('About to {tools}', { tools: tools.map(x => t(TOOL_WORD[x])).join(t(', then ')) })}</p>}
    </div>
  );
}

/** The reasoning behind a finished turn, folded. */
export function ReasoningNote({ steps }: { steps: string[] }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  if (!steps.length) return null;
  return (
    <div className="flex flex-col gap-1.5">
      <Button variant="ghost" size="sm" icon={Brain} className="-ml-2 self-start" aria-expanded={open} onClick={() => setOpen(o => !o)}>
        {open ? t('Hide the reasoning') : t('Show the reasoning')}
        <ChevronRight aria-hidden strokeWidth={1.75} className={cx('size-3.5 text-ink-3 transition-transform duration-150 motion-reduce:transition-none', open && 'rotate-90')} />
      </Button>
      {open && <ReasoningText text={steps.join('\n\n')} />}
    </div>
  );
}
