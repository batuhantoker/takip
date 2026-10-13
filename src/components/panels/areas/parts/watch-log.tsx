'use client';

import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { PanelSection } from '@/components/ui/panel';
import { Switch } from '@/components/ui/switch';
import type { WatchEvent } from '@/lib/areas/watch';

const clock = (ms: number) => new Date(ms).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false });

/** The watch switch for one area, and what has come and gone since it was switched on. */
export default function WatchLog({ watched, onToggle, events }: {
  watched: boolean;
  onToggle: () => void;
  events: WatchEvent[];
}) {
  return (
    <PanelSection title="Watch" hint={watched && events.length ? `${events.length} ${events.length === 1 ? 'change' : 'changes'}` : undefined}>
      <Switch checked={watched} onChange={onToggle} label="Watch this area"
        description="List anything that enters or leaves while TAKIP is open." />
      {watched && (
        events.length === 0 ? (
          <p className="mt-3 text-small text-ink-3">Nothing has come or gone yet. What is inside now is the starting point.</p>
        ) : (
          <ol className="mt-3 flex flex-col">
            {events.map(ev => {
              const Icon = ev.kind === 'enter' ? ArrowDownRight : ArrowUpRight;
              return (
                <li key={ev.id} className="flex min-h-8 items-center gap-3 py-1">
                  <time dateTime={new Date(ev.at).toISOString()} className="w-10 shrink-0 font-mono text-meta text-ink-3 tabular-nums">{clock(ev.at)}</time>
                  <Icon aria-hidden className={`size-3.5 shrink-0 ${ev.kind === 'enter' ? 'text-green' : 'text-ink-3'}`} strokeWidth={1.75} />
                  <span className="min-w-0 flex-1 truncate text-small text-ink-1">
                    {ev.label} <span className="text-ink-3">{ev.kind === 'enter' ? 'came in' : 'left'}</span>
                  </span>
                  <span className="shrink-0 text-meta text-ink-3">{ev.layerLabel}</span>
                </li>
              );
            })}
          </ol>
        )
      )}
    </PanelSection>
  );
}
