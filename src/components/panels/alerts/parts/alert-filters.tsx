'use client';

import { ListFilter } from 'lucide-react';
import { Button, IconButton } from '@/components/ui/button';
import { cx, FOCUS_RING, TRANSITION } from '@/components/ui/class-names';
import { SearchField } from '@/components/ui/search-field';
import { MenuDivider, MenuItem } from '@/components/ui/menu-item';
import { Popover } from '@/components/ui/popover';
import { Tooltip } from '@/components/ui/tooltip';
import { BLOCS, BLOC_ORDER, type AlertThread, type Bloc } from '@/lib/alerts/digest';
import type { NewsAlert } from '@/lib/alerts/live-alerts';
import type { AlertTab, NewsKind } from '@/components/panels/alerts/hooks/use-alert-list';

const PLACEHOLDER: Record<AlertTab, string> = {
  all: 'Search headlines, places, channels',
  news: 'Search headlines, places, channels',
  warnings: 'Search warnings by place or type',
  quakes: 'Search earthquakes by place',
};

const PERSPECTIVE: Record<AlertThread['perspective'], string> = {
  cross: 'carried by both sides',
  single: 'all from one side',
  mixed: 'not carried by both sides',
};

/** Search, the side a report comes from, and the stories the feed clusters into. */
export default function AlertFilters({ tab, query, setQuery, bloc, setBloc, news, threads, threadId, selectThread, showThreads = true }: {
  tab: AlertTab;
  query: string;
  setQuery: (q: string) => void;
  bloc: Bloc | 'all';
  setBloc: (b: Bloc | 'all') => void;
  news: NewsAlert[];
  threads: AlertThread[];
  threadId: string | null;
  selectThread: (id: string | null) => void;
  /** Off while the brief lists the same stories. */
  showThreads?: boolean;
}) {
  const aboutReports = tab === 'all' || tab === 'news';
  const countFor = (b: Bloc) => news.filter(n => n.bloc === b || n.carriers.some(c => c.bloc === b)).length;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <SearchField value={query} onChange={setQuery} placeholder={PLACEHOLDER[tab]} label="Search alerts" className="flex-1" />
        {aboutReports && (
          <Popover role="menu" label="Filter by side" placement="bottom" align="end" className="w-64 p-1"
            trigger={<IconButton label={bloc === 'all' ? 'Filter by side' : `Showing ${BLOCS[bloc].label} only`} icon={ListFilter} active={bloc !== 'all'} />}>
            {close => (
              <>
                <p className="px-2 pt-1.5 pb-1 text-meta font-medium text-ink-3">Show reports from</p>
                <MenuItem selected={bloc === 'all'} hint={news.length.toLocaleString()} onSelect={() => { setBloc('all'); close(); }}>All sides</MenuItem>
                <MenuDivider />
                {BLOC_ORDER.map(b => (
                  <MenuItem key={b} selected={bloc === b} hint={countFor(b).toLocaleString()} onSelect={() => { setBloc(b); close(); }}>
                    {BLOCS[b].label}
                  </MenuItem>
                ))}
              </>
            )}
          </Popover>
        )}
      </div>

      {aboutReports && showThreads && threads.length > 0 && (
        // The fades say the row goes on past the edge; the padding keeps focus rings from being clipped.
        <div role="group" aria-label="Stories"
          className="-mx-4 -my-1 flex gap-1.5 overflow-x-auto px-4 py-1 [scrollbar-width:none] [mask-image:linear-gradient(to_right,transparent,black_16px,black_calc(100%-32px),transparent)] [&::-webkit-scrollbar]:hidden">
          {threads.map(t => {
            const on = t.id === threadId;
            return (
              <Tooltip key={t.id} side="bottom" label={`${t.count} reports from ${t.sources.length} channels, ${PERSPECTIVE[t.perspective]}`}>
                <button
                  type="button"
                  aria-pressed={on}
                  onClick={() => selectThread(on ? null : t.id)}
                  className={cx(
                    'inline-flex h-7 shrink-0 items-center gap-1.5 rounded-control border px-2.5 text-small whitespace-nowrap',
                    on ? 'border-line-strong bg-surface-3 text-ink-1' : 'border-line text-ink-2 hover:bg-surface-2 hover:text-ink-1',
                    FOCUS_RING,
                    TRANSITION,
                  )}
                >
                  {t.label}
                  <span className="font-mono text-meta text-ink-3 tabular-nums">{t.count}</span>
                </button>
              </Tooltip>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** What the list is narrowed to, in words, with one way back. */
export function FilterSummary({ shown, thread, bloc, newsKind, query, onClear }: {
  shown: number;
  thread: AlertThread | null;
  bloc: Bloc | 'all';
  newsKind: NewsKind | null;
  query: string;
  onClear: () => void;
}) {
  const parts = [
    newsKind === 'rocket' ? 'rocket reports' : newsKind === 'breaking' ? 'breaking reports' : null,
    thread?.label,
    bloc !== 'all' ? BLOCS[bloc].label : null,
    query ? `“${query}”` : null,
  ].filter(Boolean);
  return (
    <div className="flex min-h-7 items-center gap-2 text-small text-ink-2">
      <span className="min-w-0 flex-1 truncate">
        <span className="font-mono text-ink-1 tabular-nums">{shown.toLocaleString()}</span> {shown === 1 ? 'match' : 'matches'}
        {parts.length > 0 && <span className="text-ink-3"> · {parts.join(' · ')}</span>}
      </span>
      <Button variant="ghost" size="sm" className="-mr-2" onClick={onClear}>Clear</Button>
    </div>
  );
}
