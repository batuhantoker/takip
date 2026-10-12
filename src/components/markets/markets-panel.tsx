'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import dynamic from 'next/dynamic';
import { motion } from 'framer-motion';
import { BarChart3, ChevronDown, ChevronUp, Maximize2, Minimize2, TriangleAlert } from 'lucide-react';
import AiOverview from '@/components/alerts/ai-overview';
import DonBotScan from './donbot-scan';
import CommandLine from './command-line';
import FunctionKeys from './function-keys';
import { BreadthCard, MarketHeatmap, Movers, PulseMonitor } from './market-board';
import MarketsHelp from './markets-help';
import SecurityTable from './security-table';
import { useNow } from './use-now';
import {
  FUNCTIONS, PULSE, WEI_REGIONS,
  exchangeClocks, longName, parseCommand, parseWatchlist, sortQuotes, suggest, toggleWatch, tradeTime,
  WATCHLIST_KEY,
  type FunctionCode, type MarketQuote as Quote, type SortKey, type Suggestion,
} from '@/lib/markets';
import { FEED_SECTIONS, SECTION_OF, T } from '@/lib/markets-terminal';

/**
 * TAKIP — the markets terminal.
 *
 * Driven the way a market terminal is — a command line that takes a ticker or
 * a function code, numbered function keys, one dense monitor — and dressed in
 * TAKIP's own glass, gold and theme colours, so it sits with RECON and the
 * rest of the HUD rather than apart from them. The monitor widens to more
 * columns as the panel does: price and move docked; net change, day range,
 * 52-week position, last trade and volume in full screen.
 *
 * Nothing here costs a request of its own: every column comes from the one
 * quote per instrument the feed already fetches.
 */

// Canvas charting has no business in the server bundle, and it only mounts
// once a security is loaded.
const MarketChart = dynamic(() => import('./market-chart'), { ssr: false });

interface MarketsPanelProps { data: any; spaceWeather?: any; }

export default function MarketsPanel({ data, spaceWeather }: MarketsPanelProps) {
  const [expanded, setExpanded] = useState(true);
  const [maximized, setMaximized] = useState(false);
  /** Starred symbols, kept in this browser only. */
  const [watchlist, setWatchlist] = useState<string[]>(() => {
    if (typeof window === 'undefined') return [];
    try { return parseWatchlist(window.localStorage.getItem(WATCHLIST_KEY)); } catch { return []; }
  });
  const [fn, setFn] = useState<FunctionCode | 'HELP'>(() => (watchlist.length ? 'WATCH' : 'WEI'));
  /** The security loaded into the chart, if any. */
  const [selected, setSelected] = useState<string | null>(null);
  const [sort, setSort] = useState<{ key: SortKey; asc: boolean }>({ key: 'feed', asc: false });
  const [command, setCommand] = useState('');
  const [pick, setPick] = useState(-1);
  const [miss, setMiss] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const now = useNow(30_000);
  const markets = useMemo(() => data.markets || {}, [data.markets]);

  /** Every instrument, tagged with its section. */
  const allQuotes = useMemo<Quote[]>(
    () => FEED_SECTIONS.flatMap(s => Object.values<Quote>(markets[s] || {}).map(q => ({ ...q, group: q.group ?? s })))
      .filter(q => Number.isFinite(q?.price) && Number.isFinite(q?.change_percent)),
    [markets],
  );
  const bySymbol = useMemo(() => new Map(allQuotes.map(q => [q.symbol, q])), [allQuotes]);
  const feedLoaded = Boolean(markets.timestamp || markets.error);

  const breadth = useMemo(() => {
    if (!allQuotes.length) return null;
    const up = allQuotes.filter(q => q.change_percent > 0).length;
    const down = allQuotes.filter(q => q.change_percent < 0).length;
    const sorted = [...allQuotes].sort((a, b) => b.change_percent - a.change_percent);
    return { up, down, flat: allQuotes.length - up - down, total: allQuotes.length, best: sorted.slice(0, 5), worst: sorted.slice(-5).reverse() };
  }, [allQuotes]);

  // Full screen covers the map, so Escape must get out of it — unloading the
  // chart first, the nearer thing to dismiss.
  useEffect(() => {
    if (!maximized) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      if (selected) setSelected(null);
      else setMaximized(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [maximized, selected]);

  useEffect(() => {
    if (!miss) return;
    const t = setTimeout(() => setMiss(null), 2600);
    return () => clearTimeout(t);
  }, [miss]);

  const star = useCallback((symbol: string) => {
    setWatchlist(prev => {
      const next = toggleWatch(prev, symbol);
      try { window.localStorage.setItem(WATCHLIST_KEY, JSON.stringify(next)); } catch { /* storage blocked */ }
      return next;
    });
  }, []);

  const open = useCallback((q: { symbol: string }) => {
    setSelected(prev => (prev === q.symbol ? null : q.symbol));
  }, []);

  /** Load a security: chart it, and bring up the function that lists it. */
  const load = useCallback((symbol: string) => {
    const q = bySymbol.get(symbol);
    if (!q) return;
    setSelected(symbol);
    if (q.group && SECTION_OF[q.group] && fn !== 'WATCH') setFn(SECTION_OF[q.group]);
  }, [bySymbol, fn]);

  const run = useCallback((s?: Suggestion) => {
    const typed = command;
    setCommand('');
    setPick(-1);
    if (s) {
      if (s.kind === 'function') setFn(s.value as FunctionCode);
      else load(s.value);
      return;
    }
    const cmd = parseCommand(typed, allQuotes);
    if (cmd.kind === 'function') setFn(cmd.code);
    else if (cmd.kind === 'security') load(cmd.symbol);
    else if (cmd.kind === 'help') setFn('HELP');
    else if (typed.trim()) setMiss(typed.trim().toUpperCase().slice(0, 24));
  }, [command, allQuotes, load]);

  const suggestions = useMemo(() => suggest(command, allQuotes), [command, allQuotes]);

  /** Names start A→Z and numbers biggest first; a second click reverses, a third goes back to feed order. */
  const onSort = useCallback((k: SortKey) => {
    setSort(prev => {
      const first = k === 'name';
      if (prev.key !== k) return { key: k, asc: first };
      if (prev.asc === first) return { key: k, asc: !first };
      return { key: 'feed', asc: false };
    });
  }, []);

  const current = fn === 'HELP' ? null : FUNCTIONS.find(f => f.code === fn)!;

  /** The rows for the function on screen, grouped by region on WEI. */
  const groups = useMemo<{ label?: string; rows: Quote[] }[]>(() => {
    if (!current || current.section === 'donbot') return [];
    if (current.section === 'watch') {
      return [{ rows: sortQuotes(watchlist.map(s => bySymbol.get(s)).filter((q): q is Quote => !!q), sort.key, sort.asc) }];
    }
    const rows = allQuotes.filter(q => q.group === current.section);
    if (current.code === 'WEI' && sort.key === 'feed') {
      return WEI_REGIONS
        .map(r => ({ label: r.label, rows: r.symbols.map(s => bySymbol.get(s)).filter((q): q is Quote => !!q) }))
        .filter(g => g.rows.length);
    }
    return [{ rows: sortQuotes(rows, sort.key, sort.asc) }];
  }, [current, allQuotes, bySymbol, watchlist, sort]);

  const rowCount = groups.reduce((n, g) => n + g.rows.length, 0);
  const openCount = groups.reduce((n, g) => n + g.rows.filter(q => q.market_open).length, 0);
  const updated = markets.timestamp ? tradeTime(Date.parse(markets.timestamp) / 1000, now) : '—';
  /* Full screen always has a chart up: the one loaded, else the first benchmark. */
  const chartSymbol = selected ?? (maximized ? (bySymbol.has(PULSE[0].symbol) ? PULSE[0].symbol : allQuotes[0]?.symbol ?? null) : null);
  const chartQuote = chartSymbol ? bySymbol.get(chartSymbol) : undefined;

  /* ── The pieces, shared by both layouts ───────────────────── */

  const feedStatus = (
    <span className="text-[9px] font-mono tracking-wider tabular-nums whitespace-nowrap" style={{ color: T.faint }} title="When the feed was last built, UTC">
      UPD {updated}Z
    </span>
  );

  const clocks = (
    <div className="hidden xl:flex items-center gap-3 text-[10px] font-mono tabular-nums" title="Regular sessions, local time. Holidays and early closes are not shown.">
      {exchangeClocks(new Date(now)).map(c => (
        <span key={c.code} className="flex items-center gap-1">
          <span style={{ color: T.faint }}>{c.code}</span>
          <span style={{ color: T.dim }}>{c.time}</span>
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: c.open ? T.up : T.faint, opacity: c.open ? 1 : 0.5 }} title={c.open ? 'Open' : 'Closed'} />
        </span>
      ))}
    </div>
  );

  const commandLine = (
    <CommandLine
      command={command} setCommand={setCommand} pick={pick} setPick={setPick}
      miss={miss} setMiss={setMiss} suggestions={suggestions} run={run}
    />
  );

  const functionKeys = <FunctionKeys fn={fn} setFn={setFn} maximized={maximized} />;

  const monitor = allQuotes.length > 0 && (
    <PulseMonitor bySymbol={bySymbol} chartSymbol={chartSymbol} open={open} maximized={maximized} />
  );

  const breadthCard = breadth && <BreadthCard breadth={breadth} open={open} />;

  const alerts = Array.isArray(markets.scm_alerts) && markets.scm_alerts.length > 0 && (
    <div className="space-y-1">
      {markets.scm_alerts.map((alert: string, i: number) => (
        <div key={i} className="flex items-start gap-1.5 px-2 py-1.5 rounded-md border border-[var(--alert-orange)]/40 bg-[var(--alert-orange)]/10 text-[10px] font-mono leading-snug" style={{ color: T.alert }}>
          <TriangleAlert className="w-3 h-3 mt-px shrink-0" />
          <span>{String(alert).replace(/^\W+\s*/u, '')}</span>
        </div>
      ))}
    </div>
  );

  const chart = chartSymbol && chartQuote && (
    <MarketChart key={chartSymbol} symbol={chartSymbol} name={longName(chartQuote)} large={maximized} onClose={() => setSelected(null)} />
  );

  const help = <MarketsHelp />;

  const content = fn === 'HELP' ? help
    : current?.section === 'donbot' ? <DonBotScan />
    : (
      <div className="rounded-lg border border-[var(--border-secondary)] bg-black/20 overflow-hidden">
        <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-[var(--border-secondary)] text-[9px] font-mono tracking-wider">
          <span style={{ color: T.accent }}>{current?.title.toUpperCase()}</span>
          {rowCount > 0 && current?.section !== 'crypto' && (
            <span style={{ color: T.faint }}>{openCount ? <><span style={{ color: T.up }}>●</span> {openCount} OF {rowCount} TRADING</> : `${rowCount} · SESSIONS CLOSED`}</span>
          )}
        </div>
        {rowCount > 0 ? (
          <div className="px-1 pb-1">
            <SecurityTable groups={groups} selected={chartSymbol} watchlist={watchlist} sort={sort} onSort={onSort} onOpen={open} onStar={star} now={now} />
          </div>
        ) : (
          <div className="py-4 text-center text-[10px] font-mono tracking-wider" style={{ color: T.faint }}>
            {current?.section === 'watch' ? 'Nothing on watch yet — ★ a row to add it.'
              : feedLoaded ? 'FEED UNAVAILABLE — RETRYING' : 'LOADING…'}
          </div>
        )}
      </div>
    );

  const heatmap = allQuotes.length > 0 && (
    <MarketHeatmap allQuotes={allQuotes} chartSymbol={chartSymbol} open={open} setFn={setFn} />
  );

  const movers = breadth && <Movers breadth={breadth} open={open} />;

  const footer = (
    <div className="flex items-center justify-between gap-2 text-[9px] font-mono tracking-wider" style={{ color: T.faint }}>
      {spaceWeather ? (
        <span className="truncate">
          SPACE WX{' '}
          <span style={{ color: spaceWeather.storm_color || T.text }}>
            {spaceWeather.kp_index == null ? 'no reading' : `Kp ${spaceWeather.kp_index} — ${spaceWeather.storm_level}`}
          </span>
          {spaceWeather.solar_flares?.length > 0 && <> · flare {spaceWeather.solar_flares[0].class}</>}
        </span>
      ) : <span />}
      <span className="shrink-0">YAHOO · NOAA</span>
    </div>
  );

  // AiOverview builds tints by appending alpha to the colour, so it needs a hex.
  const ai = <AiOverview mode="markets" payload={{ markets, spaceWeather }} accent="#D4AF37" />;

  const toggleMax = () => { setMaximized(m => !m); setExpanded(true); };

  if (maximized && mounted && typeof document !== 'undefined') {
    /* Full screen, built like RECON's: a window over a dimmed map, the
       monitor and the day's heatmap on the left, the chart and what moved
       beside it. Each column scrolls on its own. */
    return createPortal(
      <div className="fixed inset-4 z-[999] flex items-center justify-center">
        <div className="absolute inset-[-1rem] bg-black/60 backdrop-blur-sm" onClick={() => setMaximized(false)} />
        <div className="relative w-full h-full max-w-[1500px] glass-panel bg-[#0a0a09]/97 backdrop-blur-2xl border border-[var(--gold-primary)]/40 rounded-xl flex flex-col overflow-hidden shadow-2xl" role="region" aria-label="Markets terminal">
          <div className="flex items-center justify-between gap-4 px-6 py-3.5 border-b border-[var(--border-secondary)] bg-[#111] shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <BarChart3 className="w-5 h-5 shrink-0" style={{ color: T.accent }} />
              <span className="hud-text text-[16px] text-[var(--text-primary)] whitespace-nowrap">TAKIP MARKETS</span>
              <span className="gotham-tag gotham-tag--classified" style={{ fontSize: '9px' }}>{allQuotes.length} INSTRUMENTS</span>
              <span className="text-[var(--text-muted)]/40">/</span>
              <span className="text-[11px] font-mono font-bold tracking-wider truncate" style={{ color: T.accent }}>
                {current ? `${current.code} · ${current.title.toUpperCase()}` : 'HELP'}
              </span>
            </div>
            <div className="flex items-center gap-4 shrink-0">
              {clocks}
              {feedStatus}
              <button onClick={toggleMax} className="p-2 hover:bg-white/5 rounded transition-colors text-[var(--text-muted)] hover:text-white" title="Exit full screen (Esc)" aria-label="Restore">
                <Minimize2 className="w-5 h-5" />
              </button>
            </div>
          </div>
          <div className="flex-1 min-h-0 flex flex-col gap-2.5 p-4">
            <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-2.5 shrink-0">
              {commandLine}
              {functionKeys}
            </div>
            {monitor}
            <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(380px,34%)] gap-4 overflow-y-auto lg:overflow-hidden styled-scrollbar">
              <div className="min-h-0 lg:overflow-y-auto styled-scrollbar space-y-2.5 pr-1">
                {content}
                {heatmap}
              </div>
              <div className="min-h-0 lg:overflow-y-auto styled-scrollbar space-y-2.5 lg:border-l lg:border-[var(--border-secondary)] lg:pl-4">
                {chart}
                {breadthCard}
                {alerts}
                {movers}
                {footer}
                {ai}
              </div>
            </div>
          </div>
        </div>
      </div>,
      document.body,
    );
  }

  return (
    // Opacity only on entry: a transform left behind here offsets the `fixed`
    // full-screen box away from its inset.
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}
      className="glass-panel relative flex flex-col overflow-hidden pointer-events-auto"
      role="region"
      aria-label="Markets terminal"
    >
      {/* The same header RECON wears: icon, title, a tag for what is on screen. */}
      <div className="flex items-center justify-between gap-2 px-3.5 py-2.5 border-b border-[rgba(255,255,255,0.05)] bg-[rgba(0,0,0,0.3)] hover:bg-[var(--hover-accent)] transition-colors shrink-0">
        <button onClick={() => setExpanded(e => !e)} className="flex items-center gap-2 min-w-0">
          <BarChart3 className="w-3.5 h-3.5 shrink-0" style={{ color: T.accent }} />
          <span className="hud-text text-[11px] text-[var(--text-primary)]">MARKETS</span>
          <span className="gotham-tag gotham-tag--classified truncate" style={{ fontSize: '9px', padding: '1px 5px' }}>{current ? current.code : 'HELP'}</span>
        </button>
        <div className="flex items-center gap-2.5 shrink-0">
          {feedStatus}
          <button onClick={toggleMax} className="p-1.5 -m-0.5 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-white/10 transition-colors" title="Full screen" aria-label="Full screen">
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
          <div className="w-1.5 h-1.5 rounded-full animate-takip-pulse" style={{ background: markets.error ? T.down : T.accent }} />
          <button onClick={() => setExpanded(e => !e)} title={expanded ? 'Collapse' : 'Expand'} aria-label={expanded ? 'Collapse' : 'Expand'}>
            {expanded ? <ChevronUp className="w-3.5 h-3.5 text-[var(--text-muted)]" /> : <ChevronDown className="w-3.5 h-3.5 text-[var(--text-muted)]" />}
          </button>
        </div>
      </div>
      {expanded && (
        /* One scroll region, capped so the panel ends above the status bar. */
        <div className="space-y-2 px-3 py-3 overflow-y-auto styled-scrollbar max-h-[calc(100vh-11rem)]">
          {commandLine}
          {functionKeys}
          {monitor}
          {breadthCard}
          {alerts}
          {chart}
          {content}
          {footer}
          {ai}
        </div>
      )}
    </motion.div>
  );
}
