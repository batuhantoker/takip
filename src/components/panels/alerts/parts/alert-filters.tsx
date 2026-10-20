'use client';

import type { ReactNode } from 'react';
import { ListFilter } from 'lucide-react';
import { Button, IconButton } from '@/components/ui/button';
import { cx, FOCUS_RING, TRANSITION } from '@/components/ui/class-names';
import { SearchField } from '@/components/ui/search-field';
import { MenuDivider, MenuItem } from '@/components/ui/menu-item';
import { Popover } from '@/components/ui/popover';
import { Tooltip } from '@/components/ui/tooltip';
import { useT } from '@/components/ui/use-t';
import { msg } from '@/lib/core/i18n/translator';
import { BLOCS, BLOC_ORDER, type AlertThread, type Bloc } from '@/lib/intel/alerts/digest';
import type { NewsAlert } from '@/lib/intel/alerts/live-alerts';
import type { AlertTab, NewsKind } from '@/components/panels/alerts/hooks/use-alert-list';

const PLACEHOLDER: Record<AlertTab, string> = {
  all: msg('Search headlines, places, channels'),
  news: msg('Search headlines, places, channels'),
  warnings: msg('Search warnings by place or type'),
  quakes: msg('Search earthquakes by place'),
};

const PERSPECTIVE: Record<AlertThread['perspective'], string> = {
  cross: msg('carried by both sides'),
  single: msg('all from one side'),
  mixed: msg('not carried by both sides'),
};

/** Search, the side a report comes from, and the stories the feed clusters into. */
export default function AlertFilters({ tab, query, setQuery, bloc, setBloc, news, threads, threadId, selectThread, showThreads = true, reportFilters }: {
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
  /** More controls beside the side filter, shown while the list holds reports. */
  reportFilters?: ReactNode;
}) {
  const t = useT();
  const aboutReports = tab === 'all' || tab === 'news';
  const countFor = (b: Bloc) => news.filter(n => n.bloc === b || n.carriers.some(c => c.bloc === b)).length;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <SearchField value={query} onChange={setQuery} placeholder={t(PLACEHOLDER[tab])} label={t('Search alerts')} className="flex-1" />
        {aboutReports && (
          <Popover role="menu" label={t('Filter by side')} placement="bottom" align="end" className="w-80 p-1"
            trigger={<IconButton label={bloc === 'all' ? t('Filter by side') : t('Showing {side} only', { side: t(BLOCS[bloc].label) })} icon={ListFilter} active={bloc !== 'all'} />}>
            {close => (
              <>
                <p className="px-2 pt-1.5 pb-1 text-meta font-medium text-ink-3">{t('Show reports from')}</p>
                <MenuItem selected={bloc === 'all'} hint={news.length.toLocaleString(t.intl)} onSelect={() => { setBloc('all'); close(); }}>{t('All sides')}</MenuItem>
                <MenuDivider />
                {BLOC_ORDER.map(b => (
                  <MenuItem key={b} selected={bloc === b} hint={countFor(b).toLocaleString(t.intl)} onSelect={() => { setBloc(b); close(); }}>
                    {t(BLOCS[b].label)}
                  </MenuItem>
                ))}
              </>
            )}
          </Popover>
        )}
        {aboutReports && reportFilters}
      </div>

      {aboutReports && showThreads && threads.length > 0 && (
        // The fades say the row goes on past the edge; the padding keeps focus rings from being clipped.
        <div role="group" aria-label={t('Stories')}
          className="-mx-4 -my-1 flex gap-1.5 overflow-x-auto px-4 py-1 [scrollbar-width:none] [mask-image:linear-gradient(to_right,transparent,black_16px,black_calc(100%-32px),transparent)] [&::-webkit-scrollbar]:hidden">
          {threads.map(th => {
            const on = th.id === threadId;
            const label = t('{reports, plural, one {# report} other {# reports}} from {channels, plural, one {# channel} other {# channels}}, {perspective}', {
              reports: th.count, channels: th.sources.length, perspective: t(PERSPECTIVE[th.perspective]),
            });
            return (
              <Tooltip key={th.id} side="bottom" label={label}>
                <button
                  type="button"
                  aria-pressed={on}
                  onClick={() => selectThread(on ? null : th.id)}
                  className={cx(
                    'inline-flex h-7 shrink-0 items-center gap-1.5 rounded-control border px-2.5 text-small whitespace-nowrap',
                    on ? 'border-line-strong bg-surface-3 text-ink-1' : 'border-line text-ink-2 hover:bg-surface-2 hover:text-ink-1',
                    FOCUS_RING,
                    TRANSITION,
                  )}
                >
                  {th.label}
                  <span className="font-mono text-meta text-ink-3 tabular-nums">{th.count}</span>
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
  const t = useT();
  const parts = [
    newsKind === 'rocket' ? t('rocket reports') : newsKind === 'breaking' ? t('breaking reports') : null,
    thread?.label,
    bloc !== 'all' ? t(BLOCS[bloc].label) : null,
    query ? t('“{query}”', { query }) : null,
  ].filter(Boolean);
  return (
    <div className="flex min-h-7 items-center gap-2 text-small text-ink-2">
      <span className="min-w-0 flex-1 truncate">
        {t.rich('{n, plural, one {{count} match} other {{count} matches}}', {
          n: shown,
          count: <span className="font-mono text-ink-1 tabular-nums">{shown.toLocaleString(t.intl)}</span>,
        })}
        {parts.length > 0 && <span className="text-ink-3"> · {parts.join(' · ')}</span>}
      </span>
      <Button variant="ghost" size="sm" className="-mr-2" onClick={onClear}>{t('Clear')}</Button>
    </div>
  );
}
