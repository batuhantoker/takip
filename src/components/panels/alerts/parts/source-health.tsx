'use client';

import type { ReactNode } from 'react';
import { cx, FOCUS_RING, TRANSITION } from '@/components/ui/class-names';
import { Popover } from '@/components/ui/popover';
import { Dot, type DotTone } from '@/components/ui/tag';
import type { SourceHealth as Source } from '@/lib/intel/alerts/live-alerts';
import { ago } from '@/components/panels/alerts/format';

function state(s: Source, now: number): { tone: DotTone; text: ReactNode } {
  if (s.count > 0) return { tone: 'green', text: ago(s.latest, now) || 'reporting' };
  if (s.latest) {
    const since = ago(s.latest, now);
    return { tone: 'amber', text: since.endsWith(' ago') ? `quiet for ${since.slice(0, -4)}` : 'quiet' };
  }
  return { tone: 'red', text: 'not reachable' };
}

/**
 * "19 of 20 sources reporting", and behind it the list. Channels and wires are
 * listed apart, since a channel going quiet and a wire going quiet mean different things.
 */
export default function SourceHealth({ sources, now }: { sources: Source[]; now: number }) {
  if (!sources.length) {
    return <span className="flex items-center gap-2"><Dot tone="muted" />Connecting to sources…</span>;
  }
  const live = sources.filter(s => s.count > 0).length;
  const groups = (['telegram', 'wire'] as const)
    .map(kind => ({ kind, rows: sources.filter(s => (s.kind ?? 'telegram') === kind) }))
    .filter(g => g.rows.length);

  return (
    <Popover label="Sources" placement="top" align="start" className="w-80 p-3"
      trigger={
        <button type="button" className={cx('-ml-2 inline-flex h-7 items-center gap-2 rounded-control px-2 text-meta text-ink-3 hover:bg-surface-2 hover:text-ink-1', FOCUS_RING, TRANSITION)}>
          <Dot tone={live === sources.length ? 'green' : live === 0 ? 'red' : 'amber'} />
          <span><span className="font-mono tabular-nums">{live}</span> of <span className="font-mono tabular-nums">{sources.length}</span> sources reporting</span>
        </button>
      }>
      <p className="text-body font-medium text-ink-1">Sources</p>
      <p className="mb-2 text-small text-ink-3">When each one last posted. Channels are read every 3 min.</p>
      {groups.map(g => (
        <section key={g.kind} className="not-first:mt-3">
          <h4 className="mb-1 text-meta font-medium text-ink-3">{g.kind === 'telegram' ? 'Channels' : 'Wires'}</h4>
          <ul className="flex flex-col">
            {g.rows.map(s => {
              const st = state(s, now);
              return (
                <li key={s.handle} className="flex h-7 min-w-0 items-center gap-2.5 text-small">
                  <Dot tone={st.tone} />
                  <span className="min-w-0 flex-1 truncate text-ink-1">{s.name}</span>
                  <span className="shrink-0 text-meta text-ink-3">{st.text}</span>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </Popover>
  );
}
