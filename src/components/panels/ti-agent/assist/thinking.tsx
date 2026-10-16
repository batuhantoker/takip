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
import { sayInProgress, toolsInProgress, type ToolName } from '@/lib/ai/assist/protocol';
import { TOOL_DEFS } from '@/lib/ai/assist/tool-defs';

const toolWord = (t: ToolName) => TOOL_DEFS[t].title.toLowerCase();

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
  const say = sayInProgress(live.text);
  const tools = toolsInProgress(live.text);
  const word = say || tools.length ? 'Answering' : live.reasoning ? 'Thinking it through' : 'Thinking';
  return (
    <div role="status" className="flex flex-col gap-1.5">
      <p className="flex items-center gap-2 text-small text-ink-3"><Dot tone="gold" pulse />{word}</p>
      {live.reasoning && <ReasoningText text={live.reasoning} live />}
      {say && <p className="text-body leading-5 whitespace-pre-wrap text-ink-2">{say}</p>}
      {tools.length > 0 && <p className="text-meta text-ink-3">About to {tools.map(toolWord).join(', then ')}</p>}
    </div>
  );
}

/** The reasoning behind a finished turn, folded. */
export function ReasoningNote({ steps }: { steps: string[] }) {
  const [open, setOpen] = useState(false);
  if (!steps.length) return null;
  return (
    <div className="flex flex-col gap-1.5">
      <Button variant="ghost" size="sm" icon={Brain} className="-ml-2 self-start" aria-expanded={open} onClick={() => setOpen(o => !o)}>
        {open ? 'Hide the reasoning' : 'Show the reasoning'}
        <ChevronRight aria-hidden strokeWidth={1.75} className={cx('size-3.5 text-ink-3 transition-transform duration-150 motion-reduce:transition-none', open && 'rotate-90')} />
      </Button>
      {open && <ReasoningText text={steps.join('\n\n')} />}
    </div>
  );
}
