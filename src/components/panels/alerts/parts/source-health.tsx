'use client';

import type { ReactNode } from 'react';
import { cx, FOCUS_RING, TRANSITION } from '@/components/ui/class-names';
import { Popover } from '@/components/ui/popover';
import { Dot, type DotTone } from '@/components/ui/tag';
import { useT } from '@/components/ui/use-t';
import type { Translate } from '@/lib/core/i18n/translator';
import type { SourceHealth as Source } from '@/lib/intel/alerts/live-alerts';
import { ago, elapsed } from '@/components/panels/alerts/format';

function quietFor(latest: Source['latest'], now: number, t: Translate): string {
  const e = elapsed(latest, now);
  if (e?.unit === 'min') return t('quiet for {n} min', { n: e.n });
  if (e?.unit === 'h') return t('quiet for {n} h', { n: e.n });
  if (e?.unit === 'day') return t('{n, plural, one {quiet for # day} other {quiet for # days}}', { n: e.n });
  return t('quiet');
}

function state(s: Source, now: number, t: Translate): { tone: DotTone; text: ReactNode } {
  if (s.count > 0) return { tone: 'green', text: ago(s.latest, now, t) || t('reporting') };
  if (s.latest) return { tone: 'amber', text: quietFor(s.latest, now, t) };
  return { tone: 'red', text: t('not reachable') };
}

/**
 * "19 of 20 sources reporting", and behind it the list. Channels and wires are
 * listed apart, since a channel going quiet and a wire going quiet mean different things.
 */
export default function SourceHealth({ sources, now }: { sources: Source[]; now: number }) {
  const t = useT();
  if (!sources.length) {
    return <span className="flex items-center gap-2"><Dot tone="muted" />{t('Connecting to sources…')}</span>;
  }
  const live = sources.filter(s => s.count > 0).length;
  const groups = (['telegram', 'wire'] as const)
    .map(kind => ({ kind, rows: sources.filter(s => (s.kind ?? 'telegram') === kind) }))
    .filter(g => g.rows.length);

  return (
    <Popover label={t('Sources')} placement="top" align="start" className="w-80 p-3"
      trigger={
        <button type="button" className={cx('-ml-2 inline-flex h-7 items-center gap-2 rounded-control px-2 text-meta text-ink-3 hover:bg-surface-2 hover:text-ink-1', FOCUS_RING, TRANSITION)}>
          <Dot tone={live === sources.length ? 'green' : live === 0 ? 'red' : 'amber'} />
          <span>{t.rich('{live} of {total} sources reporting', {
            live: <span className="font-mono tabular-nums">{live.toLocaleString(t.intl)}</span>,
            total: <span className="font-mono tabular-nums">{sources.length.toLocaleString(t.intl)}</span>,
          })}</span>
        </button>
      }>
      <p className="text-body font-medium text-ink-1">{t('Sources')}</p>
      <p className="mb-2 text-small text-ink-3">{t('When each one last posted. Channels are read every 3 min.')}</p>
      {groups.map(g => (
        <section key={g.kind} className="not-first:mt-3">
          <h4 className="mb-1 text-meta font-medium text-ink-3">{g.kind === 'telegram' ? t('Channels') : t('Wires')}</h4>
          <ul className="flex flex-col">
            {g.rows.map(s => {
              const st = state(s, now, t);
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
