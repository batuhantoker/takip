'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronUp, MapPin, Radio, Maximize2, Minimize2, RefreshCw } from 'lucide-react';
import { timeAgo, type Bloc } from '@/lib/alert-digest';
import { ACCENT, type LiveAlertsData, type LocateOptions, type QuakeAlert, type SourceHealth, type Tab } from '@/lib/live-alerts';
import AlertControls from './alert-controls';
import AlertList from './alert-list';
import { useAlertItems } from './use-alert-items';
import { useAlertList } from './use-alert-list';

export { toWarning, urgency, expiryLabel } from '@/lib/live-alerts';
export type { LocateOptions, WarningAlert } from '@/lib/live-alerts';

interface LiveAlertsProps {
  data: LiveAlertsData;
  onLocate: (lat: number, lng: number, options?: LocateOptions) => void;
  /** Whether the reports being shown are pinned on the map, and the switch for it. */
  pinsOn?: boolean;
  onTogglePins?: (on: boolean) => void;
  /** The pinned reports the filters currently leave showing, so the map can follow. */
  onPinnedChange?: (ids: string[]) => void;
  onWatchFeed?: (url: string, name: string) => void;
  /** Re-pull /api/news. */
  onRefresh?: () => Promise<unknown> | void;
}

export default function LiveAlerts({ data, onLocate, onWatchFeed, onRefresh, pinsOn = false, onTogglePins, onPinnedChange }: LiveAlertsProps) {
  const [expanded, setExpanded] = useState(true);
  const [maximized, setMaximized] = useState(false);
  const [tab, setTab] = useState<Tab>('all');
  const [query, setQuery] = useState('');
  const [bloc, setBloc] = useState<Bloc | 'all'>('all');
  const [threadId, setThreadId] = useState<string | null>(null);
  /** Set from the "right now" strip: show only rocket reports, or only breaking ones. */
  const [newsKind, setNewsKind] = useState<'rocket' | 'breaking' | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [overviewOpen, setOverviewOpen] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const [now, setNow] = useState(() => Date.now());

  // Relative times ("12m ago") stay current while the panel is open.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!maximized) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMaximized(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [maximized]);

  const { news, quakes, warnings, threads, overviewPayload } = useAlertItems(data);
  const activeThread = threads.find(t => t.id === threadId) ?? null;
  const signature = `${news[0]?.id ?? ''}|${news.length}|${quakes[0]?.id ?? ''}`;

  const q = query.trim().toLowerCase();

  // A new tab or filter starts at the top, not wherever the last list was scrolled to.
  useEffect(() => { listRef.current?.scrollTo({ top: 0 }); }, [tab, bloc, threadId, q]);
  const { newsFiltersActive, visibleFeeds, list, pinned, grouped } = useAlertList({
    tab, bloc, newsKind, q, activeThread, news, quakes, warnings, now, onPinnedChange,
  });

  const sources: SourceHealth[] = data.news_meta?.sources ?? [];
  const liveSources = sources.filter(s => s.count > 0).length;
  const fetchedAt: string | null = data.news_meta?.fetchedAt ?? null;
  const breakingCount = news.filter(n => n.flag).length;
  const loading = data.news === undefined;
  const filtersActive = newsFiltersActive || Boolean(q);

  const clearFilters = useCallback(() => { setQuery(''); setBloc('all'); setThreadId(null); setNewsKind(null); }, []);

  /*
   * What a reader would want to know before reading anything: warnings in
   * force, rockets in the air, what a channel has flagged as breaking, and the
   * largest quake of the day. Each one is a filter, because the next thing
   * anybody does with that number is go and look at it.
   */
  const rightNow = useMemo(() => {
    const severe = warnings.filter(w => w.severity === 'high').length;
    const rockets = news.filter(n => n.alertKind === 'rocket' && now - n.ts < 6 * 3_600_000).length;
    const breaking = news.filter(n => n.flag && now - n.ts < 6 * 3_600_000).length;
    const biggest = quakes.reduce<QuakeAlert | null>((top, q) => (!top || q.magnitude > top.magnitude ? q : top), null);
    return { severe, rockets, breaking, biggest };
  }, [warnings, news, quakes, now]);

  const refresh = useCallback(async () => {
    if (!onRefresh || refreshing) return;
    setRefreshing(true);
    try { await onRefresh(); } finally { setRefreshing(false); setNow(Date.now()); }
  }, [onRefresh, refreshing]);

  const selectThread = useCallback((id: string | null) => {
    setThreadId(id);
    if (id && tab !== 'all' && tab !== 'news') setTab('news');
  }, [tab]);

  const locate = useCallback((lat: number, lng: number, options?: LocateOptions) => {
    if (maximized) setMaximized(false);
    onLocate(lat, lng, options);
  }, [maximized, onLocate]);

  /* Grouped by where each source is read from, since a channel going quiet
     and a wire going quiet mean different things. */
  const sourcesTitle = sources.length
    ? (['telegram', 'wire'] as const)
      .map(kind => {
        const group = sources.filter(s => (s.kind ?? 'telegram') === kind);
        if (!group.length) return '';
        const heading = kind === 'telegram' ? 'CHANNELS' : 'WIRES';
        const lines = group.map(s => `  ${s.name}: ${s.count ? `${s.count} items, latest ${timeAgo(s.latest, now)}` : s.latest ? `quiet — nothing in 72h (last ${timeAgo(s.latest, now)})` : 'unreachable'}`);
        return `${heading}\n${lines.join('\n')}`;
      })
      .filter(Boolean)
      .join('\n\n')
    : 'Waiting for the source report';

  /* Rocket and breaking are filters over reports; leaving one set while the
     panel shows warnings would label the list with a filter it is not using. */
  const selectTab = useCallback((id: Tab) => {
    setTab(id);
    if (id !== 'news' && id !== 'all') setNewsKind(null);
  }, []);

  const controls = (
    <AlertControls
      maximized={maximized}
      tab={tab}
      selectTab={selectTab}
      query={query}
      setQuery={setQuery}
      bloc={bloc}
      setBloc={setBloc}
      newsKind={newsKind}
      setNewsKind={setNewsKind}
      news={news}
      quakes={quakes}
      warnings={warnings}
      rightNow={rightNow}
      overviewPayload={overviewPayload}
      signature={signature}
      threads={threads}
      threadId={threadId}
      activeThread={activeThread}
      selectThread={selectThread}
      overviewOpen={overviewOpen}
      setOverviewOpen={setOverviewOpen}
      filtersActive={filtersActive}
      list={list}
      clearFilters={clearFilters}
    />
  );

  const listBody = (
    <AlertList
      tab={tab}
      visibleFeeds={visibleFeeds}
      loading={loading}
      list={list}
      grouped={grouped}
      filtersActive={filtersActive}
      maximized={maximized}
      now={now}
      openId={openId}
      setOpenId={setOpenId}
      locate={locate}
      onWatchFeed={onWatchFeed}
      onRefresh={onRefresh}
      refresh={refresh}
      clearFilters={clearFilters}
    />
  );

  const content = (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.15, duration: 0.4 }}
      role={maximized ? 'dialog' : undefined}
      aria-label={maximized ? 'Live alerts' : undefined}
      className={`glass-panel flex flex-col overflow-hidden pointer-events-auto transition-all duration-300 ${maximized ? 'fixed inset-4 z-[9999] bg-[#0a0a09]/95 backdrop-blur-3xl' : 'shrink-0 h-[560px] max-h-[82vh] resize-y'}`}
    >
      {/* Header: title and controls, then a status line */}
      <div className="flex-shrink-0 border-b border-[rgba(255,255,255,0.05)] bg-[rgba(0,0,0,0.3)]">
        <div className="flex items-center justify-between gap-2 px-3 pt-2 pb-1">
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            aria-expanded={expanded}
            className="flex min-w-0 items-center gap-2 outline-none"
          >
            <Radio className="w-3.5 h-3.5 flex-shrink-0" style={{ color: ACCENT }} />
            <span className="hud-text whitespace-nowrap text-[11px] text-[var(--text-primary)]">LIVE ALERTS</span>
            <span className="gotham-tag gotham-tag--high" style={{ fontSize: '9px', padding: '1px 5px' }}>{news.length + quakes.length}</span>
          </button>
          <div className="flex items-center gap-0.5 flex-shrink-0">
            {onTogglePins && (
              <button
                onClick={() => onTogglePins(!pinsOn)}
                aria-pressed={pinsOn}
                className={`flex items-center gap-0.5 rounded px-1 py-1 transition-colors ${pinsOn ? 'text-[#FF4081] hover:bg-[#FF4081]/15' : 'text-[var(--text-muted)] hover:bg-white/10'}`}
                title={pinsOn
                  ? `${pinned.length} of these reports are pinned on the map — click to hide the pins`
                  : 'Pin these reports on the map'}
                aria-label={pinsOn ? 'Hide alert pins on the map' : 'Show alert pins on the map'}
              >
                <MapPin className="w-3 h-3" />
                <span className="text-[9px] font-mono tabular-nums">{pinned.length}</span>
              </button>
            )}
            {onRefresh && (
              <button onClick={refresh} disabled={refreshing} className="p-1 rounded hover:bg-white/10 transition-colors" title="Refresh (channels are re-read every 3 minutes)" aria-label="Refresh alerts">
                <RefreshCw className={`w-3 h-3 text-[var(--text-muted)] ${refreshing ? 'animate-spin' : ''}`} />
              </button>
            )}
            <button
              onClick={() => { setMaximized(!maximized); if (!expanded) setExpanded(true); }}
              className="p-1 rounded hover:bg-white/10 transition-colors"
              title={maximized ? 'Restore (Esc)' : 'Maximize'}
              aria-label={maximized ? 'Restore panel' : 'Maximize panel'}
            >
              {maximized ? <Minimize2 className="w-3 h-3 text-[var(--text-muted)]" /> : <Maximize2 className="w-3 h-3 text-[var(--text-muted)]" />}
            </button>
            <button onClick={() => setExpanded(!expanded)} className="p-1 rounded hover:bg-white/10 transition-colors" aria-label={expanded ? 'Collapse panel' : 'Expand panel'}>
              {expanded ? <ChevronUp className="w-3.5 h-3.5 text-[var(--text-muted)]" /> : <ChevronDown className="w-3.5 h-3.5 text-[var(--text-muted)]" />}
            </button>
          </div>
        </div>
        <div className="flex items-center gap-1.5 px-3 pb-1.5 text-[9px] font-mono tracking-wider text-[#5C5A54] whitespace-nowrap overflow-hidden">
          {sources.length > 0 ? (
            <span
              title={sourcesTitle}
              className="flex items-center gap-1 cursor-help"
              style={{ color: liveSources === sources.length ? '#00E676' : '#FF9500' }}
            >
              <span className="h-1.5 w-1.5 rounded-full animate-takip-pulse" style={{ background: 'currentColor' }} />
              {liveSources}/{sources.length} SOURCES LIVE
            </span>
          ) : (
            <span>CONNECTING…</span>
          )}
          {fetchedAt && <span title={`Feed fetched ${new Date(fetchedAt).toLocaleString()}`}>· UPDATED {timeAgo(fetchedAt, now).toUpperCase()}</span>}
          {breakingCount > 0 && <span className="text-[#FF6B6B]">· {breakingCount} BREAKING</span>}
        </div>
      </div>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className={`flex flex-1 min-h-0 ${maximized ? 'flex-row bg-[#0a0a09]' : 'flex-col bg-transparent'}`}
          >
            {maximized ? (
              <>
                <aside className="w-[380px] flex-shrink-0 overflow-y-auto styled-scrollbar border-r border-[#2A2A28] bg-[#0e0e0d] p-4">
                  {controls}
                </aside>
                <div ref={listRef} className="flex-1 min-w-0 overflow-y-auto styled-scrollbar px-6 pt-2 pb-6">{listBody}</div>
              </>
            ) : (
              <>
                <div className="flex-shrink-0 pb-2 border-b border-[rgba(255,255,255,0.05)]">{controls}</div>
                <div ref={listRef} className="flex-1 min-h-0 overflow-y-auto styled-scrollbar px-3 pb-3">{listBody}</div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );

  // Maximising takes a click, so this branch never runs during server render.
  if (maximized && typeof document !== 'undefined') {
    return createPortal(content, document.body);
  }

  return content;
}
