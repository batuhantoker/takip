'use client';

import { Search, X } from 'lucide-react';
import AiOverview from './ai-overview';
import { ALERT_KINDS, BLOCS, BLOC_ORDER, type AlertThread, type Bloc } from '@/lib/alert-digest';
import {
  ACCENT, BUILTIN_FEEDS, SEVERITY_COLORS, quakeColor,
  type AlertItem, type NewsAlert, type QuakeAlert, type Tab, type WarningAlert,
} from '@/lib/live-alerts';

interface AlertControlsProps {
  maximized: boolean;
  tab: Tab;
  selectTab: (id: Tab) => void;
  query: string;
  setQuery: (query: string) => void;
  bloc: Bloc | 'all';
  setBloc: (bloc: Bloc | 'all') => void;
  newsKind: 'rocket' | 'breaking' | null;
  setNewsKind: (kind: 'rocket' | 'breaking' | null) => void;
  news: NewsAlert[];
  quakes: QuakeAlert[];
  warnings: WarningAlert[];
  rightNow: { severe: number; rockets: number; breaking: number; biggest: QuakeAlert | null };
  overviewPayload: unknown;
  signature: string;
  threads: AlertThread[];
  threadId: string | null;
  activeThread: AlertThread | null;
  selectThread: (id: string | null) => void;
  overviewOpen: boolean;
  setOverviewOpen: (open: boolean) => void;
  filtersActive: boolean;
  list: AlertItem[];
  clearFilters: () => void;
}

export default function AlertControls({
  maximized, tab, selectTab, query, setQuery, bloc, setBloc, newsKind, setNewsKind, news, quakes, warnings, rightNow,
  overviewPayload, signature, threads, threadId, activeThread, selectThread, overviewOpen, setOverviewOpen,
  filtersActive, list, clearFilters,
}: AlertControlsProps) {
  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: 'all', label: 'ALL', count: news.length + quakes.length + rightNow.severe },
    { id: 'news', label: 'NEWS', count: news.length },
    { id: 'warnings', label: 'WARN', count: warnings.length },
    { id: 'quakes', label: 'QUAKE', count: quakes.length },
    { id: 'feeds', label: 'FEEDS', count: BUILTIN_FEEDS.length },
  ];

  const nowStats: { key: string; label: string; value: string; color: string; title: string; onClick: () => void }[] = [
    { key: 'severe', label: 'SEVERE', value: String(rightNow.severe), color: SEVERITY_COLORS.high, title: 'Warnings in force graded severe or extreme (WMO: Extreme only)', onClick: () => { selectTab('warnings'); setQuery(''); } },
    { key: 'rocket', label: 'ROCKET', value: String(rightNow.rockets), color: ALERT_KINDS.rocket.color, title: 'Reports of rockets or missiles in the last six hours', onClick: () => { selectTab('news'); setNewsKind(newsKind === 'rocket' ? null : 'rocket'); } },
    { key: 'breaking', label: 'BREAKING', value: String(rightNow.breaking), color: ACCENT, title: 'Reports a channel flagged as breaking in the last six hours', onClick: () => { selectTab('news'); setNewsKind(newsKind === 'breaking' ? null : 'breaking'); } },
    ...(rightNow.biggest ? [{
      key: 'quake',
      label: 'QUAKE',
      value: `M${rightNow.biggest.magnitude.toFixed(1)}`,
      color: quakeColor(rightNow.biggest.magnitude),
      title: `Largest earthquake in the last day — ${rightNow.biggest.place}`,
      onClick: () => selectTab('quakes'),
    }] : []),
  ];

  return (
    <div className={`space-y-2 ${maximized ? '' : 'px-3 pt-2'}`}>
      {/* What needs attention right now */}
      <div className="flex gap-1">
        {nowStats.map(stat => {
          const active = (stat.key === 'rocket' && newsKind === 'rocket')
            || (stat.key === 'breaking' && newsKind === 'breaking')
            || (stat.key === 'severe' && tab === 'warnings')
            || (stat.key === 'quake' && tab === 'quakes');
          const quiet = stat.value === '0';
          return (
            <button
              key={stat.key}
              type="button"
              onClick={stat.onClick}
              title={stat.title}
              aria-pressed={active}
              className={`flex-1 rounded border px-1 py-1 text-center transition-colors ${active ? 'bg-white/[0.06]' : 'hover:bg-white/[0.04]'}`}
              style={{ borderColor: quiet ? '#26262A' : `${stat.color}55` }}
            >
              <div className="text-[12px] font-mono font-bold leading-none tabular-nums" style={{ color: quiet ? '#5C5A54' : stat.color }}>{stat.value}</div>
              <div className="mt-0.5 text-[7.5px] font-mono tracking-widest text-[#8A8880]">{stat.label}</div>
            </button>
          );
        })}
      </div>

      {/* Tabs */}
      <div className="flex gap-1" role="tablist">
        {tabs.map(t => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => selectTab(t.id)}
            className={`flex-1 rounded px-1.5 py-1 text-[10px] font-mono tracking-wider transition-all ${tab === t.id ? 'bg-[var(--cyan-primary)]/15 text-[var(--cyan-primary)] border border-[var(--cyan-primary)]/45' : 'text-[#8A8880] border border-transparent hover:text-[#E8E6E0] hover:bg-[#2A2A28]'}`}
          >
            {t.label} <span className="opacity-60 tabular-nums">{t.count}</span>
          </button>
        ))}
      </div>

      {/* Search and perspective */}
      <div className="flex gap-1.5">
        <label className="relative flex-1 min-w-0">
          <span className="sr-only">Search alerts</span>
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-[#5C5A54]" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={tab === 'feeds' ? 'Search feeds…' : 'Search headlines, places, channels…'}
            className="w-full rounded border border-[#2A2A28] bg-black/30 py-1 pl-6 pr-6 text-[11px] text-[#E8E6E0] placeholder:text-[#5C5A54] outline-none focus:border-[var(--cyan-primary)]/50"
          />
          {query && (
            <button onClick={() => setQuery('')} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[#5C5A54] hover:text-white" aria-label="Clear search">
              <X className="h-3 w-3" />
            </button>
          )}
        </label>
        {tab !== 'quakes' && tab !== 'warnings' && tab !== 'feeds' && (
          <select
            value={bloc}
            onChange={e => setBloc(e.target.value as Bloc | 'all')}
            aria-label="Filter by perspective"
            className="w-[108px] flex-shrink-0 rounded border border-[#2A2A28] bg-[#0c0c10] px-1 py-1 text-[10px] font-mono text-[#C9C5BC] outline-none focus:border-[var(--cyan-primary)]/50"
            style={bloc !== 'all' ? { color: BLOCS[bloc].color, borderColor: `${BLOCS[bloc].color}66` } : undefined}
          >
            <option value="all">All sides</option>
            {BLOC_ORDER.map(b => <option key={b} value={b}>{BLOCS[b].label}</option>)}
          </select>
        )}
      </div>

      {/* One-click AI overview of the current alert picture */}
      {tab !== 'feeds' && tab !== 'warnings' && (
        <div className={maximized ? '' : 'max-h-[240px] overflow-y-auto styled-scrollbar pr-0.5'}>
          <AiOverview
            mode="alerts"
            payload={overviewPayload}
            signature={signature}
            accent={ACCENT}
            activeThreadId={threadId}
            onThreadSelect={selectThread}
            onOpenChange={setOverviewOpen}
          />
        </div>
      )}

      {/* Threads: the same clustering the overview uses, available without a click */}
      {tab !== 'quakes' && tab !== 'warnings' && tab !== 'feeds' && threads.length > 0 && !overviewOpen && (
        <div className={maximized ? 'flex flex-wrap gap-1' : '-mx-3 flex gap-1 overflow-x-auto px-3 pb-0.5 styled-scrollbar'}>
          {threads.map(t => {
            const active = t.id === threadId;
            const dot = t.perspective === 'cross' ? '#00E676' : t.perspective === 'single' ? '#FF9500' : '#5C5A54';
            return (
              <button
                key={t.id}
                onClick={() => selectThread(active ? null : t.id)}
                aria-pressed={active}
                title={`${t.count} reports from ${t.sources.length} channels${t.topics.length ? ` — ${t.topics.join(', ')}` : ''}`}
                className={`flex flex-shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[9.5px] font-mono whitespace-nowrap transition-colors ${active ? 'text-white' : 'text-[#9B978E] hover:text-[#E8E6E0] border-[#2A2A28] hover:border-[#3A3A38]'}`}
                style={active ? { borderColor: `${ACCENT}99`, background: `${ACCENT}22` } : undefined}
              >
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: dot }} />
                {t.label}
                <span className="tabular-nums opacity-60">{t.count}</span>
              </button>
            );
          })}
        </div>
      )}

      {filtersActive && tab !== 'feeds' && (
        <div className="flex items-center justify-between rounded border border-white/5 bg-white/[0.02] px-2 py-1 text-[9.5px] font-mono text-[#8A8880]">
          <span className="truncate">
            SHOWING {list.length}{activeThread ? ` · ${activeThread.label.toUpperCase()}` : ''}{bloc !== 'all' ? ` · ${BLOCS[bloc].short}` : ''}{newsKind ? ` · ${newsKind.toUpperCase()} ONLY` : ''}
          </span>
          <button onClick={clearFilters} className="flex-shrink-0 text-[var(--cyan-primary)] hover:underline">CLEAR</button>
        </div>
      )}
    </div>
  );
}
