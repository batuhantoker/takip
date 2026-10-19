'use client';

import { Button } from '@/components/ui/button';
import { useT } from '@/components/ui/use-t';
import type { ShownGroup, ShownRow } from '@/components/shell/showing/lib/held-rows';
import { ShowingRow } from './showing-row';

/**
 * The chip's popover: where and when the map is, in a sentence or two, then everything drawn, each with its switch,
 * then what was on recently, to switch back on.
 */
export function ShowingPanel({ summary, groups, recent, tall, onSwitch, onOpenAreas, footer }: {
  summary: { title: string; body: string };
  groups: ShownGroup[];
  recent: ShownRow[];
  tall: boolean;
  onSwitch: (row: ShownRow, on: boolean) => void;
  onOpenAreas?: () => void;
  footer?: { label: string; onClick: () => void };
}) {
  const t = useT();
  return (
    <div className="flex max-h-[min(560px,calc(100dvh-140px))] flex-col">
      <header className="shrink-0 px-4 pt-3 pb-3">
        <h2 className="text-body font-semibold text-ink-1">{summary.title}</h2>
        <p className="mt-1 text-small text-ink-2">{summary.body}</p>
      </header>
      {(groups.length > 0 || recent.length > 0) && (
        <div className="styled-scrollbar min-h-0 flex-1 overflow-y-auto border-t border-line px-4 pt-2 pb-2">
          {groups.map(g => (
            <section key={g.id} aria-label={g.title} className="mb-1">
              <h3 className="pt-1.5 pb-0.5 text-meta font-medium text-ink-3">{g.title}</h3>
              <ul className="flex flex-col">
                {g.rows.map(r => (
                  <ShowingRow key={r.id} row={r} tall={tall} onSwitch={on => onSwitch(r, on)} onOpen={r.id === 'areas' ? onOpenAreas : undefined} />
                ))}
              </ul>
            </section>
          ))}
          {recent.length > 0 && (
            <section aria-label={t('Recent')} className={groups.length ? '-mx-4 mt-2 border-t border-line px-4 pt-1' : undefined}>
              <h3 className="pt-1.5 pb-0.5 text-meta font-medium text-ink-3">{t('Recent')}</h3>
              <ul className="flex flex-col">
                {recent.map(r => <ShowingRow key={r.id} row={r} tall={tall} onSwitch={on => onSwitch(r, on)} />)}
              </ul>
            </section>
          )}
        </div>
      )}
      {footer && (
        <footer className="shrink-0 border-t border-line px-2 py-1.5">
          <Button variant="ghost" size="sm" onClick={footer.onClick}>{footer.label}</Button>
        </footer>
      )}
    </div>
  );
}
