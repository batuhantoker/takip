'use client';

import { type FormEvent, useState } from 'react';
import { CalendarSearch } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cx, FOCUS_RING, TRANSITION } from '@/components/ui/class-names';
import { TextField } from '@/components/ui/field';
import { Popover } from '@/components/ui/popover';
import { Tooltip } from '@/components/ui/tooltip';

export type GoToExample = { label: string; value: string };

/** "Go to…": type a time, or pick one of a few examples. `onGo` says whether it understood the text, or why it can't go there. */
export function GoToPopover({ open, onOpenChange, onGo, placeholder, hint, examples, title = 'Go to a date' }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGo: (text: string) => boolean | string;
  placeholder: string;
  /** Shown when the text isn't a time. */
  hint: string;
  examples: GoToExample[];
  title?: string;
}) {
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const go = (value: string, close: () => void) => {
    const went = onGo(value);
    if (went !== true) {
      setError(went || hint);
      return;
    }
    setText('');
    setError(null);
    close();
  };

  // The tooltip anchors to the span (Popover and Tooltip wrappers have no box); the popover anchors to the button.
  return (
    <Tooltip label={title} kbd="J" disabled={open}>
      <span className="inline-flex">
        <Popover open={open} onOpenChange={o => { onOpenChange(o); if (!o) setError(null); }} label={title} placement="top" align="end" className="w-80 p-3"
          trigger={
            <Button variant="ghost" size="sm" icon={CalendarSearch} aria-label={title} aria-keyshortcuts="J">
              <span className="hidden @5xl/timeline:inline">Go to</span>
            </Button>
          }>
          {close => (
            <>
              <form onSubmit={(e: FormEvent) => { e.preventDefault(); go(text, close); }}>
                <TextField label={title} value={text} placeholder={placeholder} data-autofocus autoComplete="off" spellCheck={false}
                  onChange={e => { setText(e.target.value); setError(null); }}
                  error={error ?? undefined} />
              </form>
              <p className="mt-3 mb-1 text-meta font-medium text-ink-3">Or try</p>
              <ul className="-mx-1 flex flex-col">
                {examples.map(x => (
                  <li key={x.value}>
                    <button type="button" onClick={() => go(x.value, close)}
                      className={cx('flex h-8 w-full items-center gap-3 rounded-control px-2 text-left text-body text-ink-2 hover:bg-surface-2 hover:text-ink-1', FOCUS_RING, TRANSITION)}>
                      <span className="min-w-0 flex-1 truncate">{x.label}</span>
                      <span className="shrink-0 font-mono text-small text-ink-3 tabular-nums">{x.value}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Popover>
      </span>
    </Tooltip>
  );
}
