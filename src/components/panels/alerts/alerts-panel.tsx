'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MapPin, RefreshCw } from 'lucide-react';
import { Button, IconButton } from '@/components/ui/button';
import { Panel, PanelSection } from '@/components/ui/panel';
import { useT } from '@/components/ui/use-t';
import { BLOC_ORDER, type Bloc } from '@/lib/intel/alerts/digest';
import type { LiveAlertsData, LocateOptions, QuakeAlert, SourceHealth as Source } from '@/lib/intel/alerts/live-alerts';
import { BriefCard } from '@/components/panels/alerts/parts/alert-brief';
import AlertFilters, { FilterSummary } from '@/components/panels/alerts/parts/alert-filters';
import AlertList from '@/components/panels/alerts/parts/alert-list';
import AlertSummary, { type StatPick } from '@/components/panels/alerts/parts/alert-summary';
import { ago } from './format';
import LiveTv from '@/components/panels/alerts/parts/live-tv';
import { Spinner } from '@/components/panels/alerts/rows/row-parts';
import SourceHealth from '@/components/panels/alerts/parts/source-health';
import { TiGlyph } from '@/components/panels/ti-agent/atoms';
import { useAlertItems } from '@/components/panels/alerts/hooks/use-alert-items';
import { useAlertList, type AlertTab, type NewsKind } from '@/components/panels/alerts/hooks/use-alert-list';
import { useOverview } from '@/components/panels/alerts/hooks/use-overview';
import { usePersisted } from '@/components/panels/alerts/hooks/use-persisted';

interface LiveAlertsProps {
  data: LiveAlertsData;
  onLocate: (lat: number, lng: number, options?: LocateOptions) => void;
  onClose?: () => void;
  /** Whether the reports being shown are pinned on the map, and the switch for it. */
  pinsOn?: boolean;
  onTogglePins?: (on: boolean) => void;
  /** The pinned reports the filters currently leave showing, so the map can follow. */
  onPinnedChange?: (ids: string[]) => void;
  onWatchFeed?: (url: string, name: string) => void;
  /** Re-pull /api/news. */
  onRefresh?: () => Promise<unknown> | void;
}

const HOUR = 3_600_000;
const TABS: AlertTab[] = ['all', 'news', 'warnings', 'quakes'];
const isTab = (v: unknown): v is AlertTab => TABS.includes(v as AlertTab);
const isBloc = (v: unknown): v is Bloc | 'all' => v === 'all' || BLOC_ORDER.includes(v as Bloc);

export default function LiveAlerts({ data, onLocate, onClose, onWatchFeed, onRefresh, pinsOn = false, onTogglePins, onPinnedChange }: LiveAlertsProps) {
  const t = useT();
  const [tab, setTab] = usePersisted<AlertTab>('takip.alerts.tab', 'all', isTab);
  const [bloc, setBloc] = usePersisted<Bloc | 'all'>('takip.alerts.side', 'all', isBloc);
  const [query, setQuery] = useState('');
  const [threadId, setThreadId] = useState<string | null>(null);
  const [newsKind, setNewsKind] = useState<NewsKind | null>(null);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [briefOpen, setBriefOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const top = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const { news, quakes, warnings, threads, overviewPayload } = useAlertItems(data);
  const activeThread = threads.find(th => th.id === threadId) ?? null;
  const q = query.trim().toLowerCase();
  const { newsFiltersActive, list, pinned, groups } = useAlertList({
    tab, bloc, newsKind, q, activeThread, news, quakes, warnings, now, onPinnedChange,
  });
  const overview = useOverview('alerts', overviewPayload, `${news[0]?.id ?? ''}|${news.length}|${quakes[0]?.id ?? ''}`);

  // A new tab or filter starts at the top, not wherever the last list was scrolled to.
  useEffect(() => { top.current?.parentElement?.scrollTo({ top: 0 }); }, [tab, bloc, threadId, newsKind, q]);

  const sources: Source[] = data.news_meta?.sources ?? [];
  const fetchedAt = data.news_meta?.fetchedAt ?? null;
  const loading = data.news === undefined;
  const filtersActive = newsFiltersActive || Boolean(q);

  const rightNow = useMemo(() => {
    const recent = (ts: number) => now - ts < 6 * HOUR;
    return {
      severe: warnings.filter(w => w.severity === 'high').length,
      rockets: news.filter(n => n.alertKind === 'rocket' && recent(n.ts)).length,
      breaking: news.filter(n => n.flag && recent(n.ts)).length,
      biggest: quakes.reduce<QuakeAlert | null>((best, k) => (!best || k.magnitude > best.magnitude ? k : best), null),
    };
  }, [warnings, news, quakes, now]);

  const lastDay = useMemo(() => {
    const day = (ts: number) => now - ts < 24 * HOUR;
    return news.filter(n => day(n.ts)).length + quakes.filter(k => day(k.ts)).length
      + warnings.filter(w => w.severity === 'high' && day(w.ts)).length;
  }, [news, quakes, warnings, now]);

  const clearFilters = useCallback(() => { setQuery(''); setBloc('all'); setThreadId(null); setNewsKind(null); }, [setBloc]);

  const selectTab = useCallback((next: AlertTab) => {
    setTab(next);
    setOpenKey(null);
    // Rocket and breaking narrow reports; carried onto warnings they would label a list they no longer filter.
    if (next !== 'news' && next !== 'all') setNewsKind(null);
  }, [setTab]);

  const pick = (p: StatPick) => {
    if (p === 'severe') return selectTab(tab === 'warnings' ? 'all' : 'warnings');
    if (p === 'quake') return selectTab(tab === 'quakes' ? 'all' : 'quakes');
    if (tab !== 'all' && tab !== 'news') selectTab('all');
    setNewsKind(k => (k === p ? null : p));
  };
  const picked: StatPick | null = tab === 'warnings' ? 'severe' : tab === 'quakes' ? 'quake' : newsKind;

  const selectThread = useCallback((id: string | null) => {
    setThreadId(id);
    if (id && tab !== 'all' && tab !== 'news') selectTab('news');
  }, [tab, selectTab]);

  const refresh = useCallback(async () => {
    if (!onRefresh || refreshing) return;
    setRefreshing(true);
    try { await onRefresh(); } finally { setRefreshing(false); setNow(Date.now()); }
  }, [onRefresh, refreshing]);

  const toggleBrief = () => {
    setBriefOpen(o => !o);
    if (!briefOpen && !overview.result && !overview.loading) overview.generate();
  };

  const subtitle = loading
    ? t('Reading the sources…')
    : `${t('{n} in the last day', { n: lastDay })}${fetchedAt ? ` · ${t('updated {ago}', { ago: ago(fetchedAt, now, t) })}` : ''}`;

  return (
    <Panel
      title={t('Alerts')}
      subtitle={subtitle}
      onClose={onClose}
      actions={<>
        {onTogglePins && (
          <IconButton icon={MapPin} active={pinsOn} onClick={() => onTogglePins(!pinsOn)}
            label={pinsOn ? t('Hide news pins on the map') : pinned.length
              ? t('{n, plural, one {Pin # news report on the map} other {Pin # news reports on the map}}', { n: pinned.length })
              : t('Pin news reports on the map')} />
        )}
        {onRefresh && (
          <IconButton icon={refreshing ? Spinner : RefreshCw} disabled={refreshing} onClick={refresh} label={t('Refresh now')} />
        )}
      </>}
      tabs={{
        value: tab,
        onChange: selectTab,
        options: [
          { value: 'all', label: t('All') },
          { value: 'news', label: t('News') },
          { value: 'warnings', label: t('Warnings') },
          { value: 'quakes', label: t('Quakes') },
        ],
      }}
      footer={<>
        <SourceHealth sources={sources} now={now} />
        <LiveTv onWatch={f => { onLocate(f.lat, f.lng); onWatchFeed?.(f.url, f.name); }} />
      </>}
    >
      <PanelSection title={t('Right now')} action={
        <Button variant="ghost" size="sm" icon={TiGlyph} aria-expanded={briefOpen} onClick={toggleBrief}>
          {briefOpen ? t('Hide brief') : t('Brief me')}
        </Button>
      }>
        <AlertSummary rightNow={rightNow} active={picked} onPick={pick} />
        {briefOpen && (
          <div className="mt-3">
            <BriefCard overview={overview} now={now} activeThreadId={threadId} onThreadSelect={selectThread} />
          </div>
        )}
      </PanelSection>

      <div ref={top} className="mt-5">
        <AlertFilters tab={tab} query={query} setQuery={setQuery} bloc={bloc} setBloc={setBloc}
          news={news} threads={threads} threadId={threadId} selectThread={selectThread} showThreads={!briefOpen} />
      </div>

      {filtersActive && list.length > 0 && (
        <div className="mt-2">
          <FilterSummary shown={list.length} thread={activeThread} bloc={bloc} newsKind={newsKind} query={query.trim()} onClear={clearFilters} />
        </div>
      )}

      <div className="mt-3">
        <AlertList tab={tab} groups={groups} loading={loading} filtersActive={filtersActive} now={now}
          openKey={openKey} setOpenKey={setOpenKey} onLocate={onLocate}
          onRetry={onRefresh ? refresh : undefined} onClearFilters={clearFilters} />
      </div>
    </Panel>
  );
}
