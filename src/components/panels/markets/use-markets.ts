'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FUNCTIONS, PULSE, WEI_REGIONS,
  parseCommand, parseWatchlist, sortQuotes, suggest, toggleWatch,
  WATCHLIST_KEY,
  type FunctionCode, type MarketQuote as Quote, type SortKey, type Suggestion,
} from '@/lib/intel/markets/markets';
import { FEED_SECTIONS, SECTION_OF } from '@/lib/intel/markets/terminal';

export interface MarketBreadth { up: number; down: number; flat: number; total: number; best: Quote[]; worst: Quote[] }

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- the feed's market payload is untyped
type Loose = any;

/** Everything Markets knows and remembers: the quotes, the section on screen, the watchlist, the find field and the chart. */
export function useMarkets(markets: Loose, maximized: boolean) {
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

  /** Every instrument, tagged with its section. */
  const allQuotes = useMemo<Quote[]>(
    () => FEED_SECTIONS.flatMap(s => Object.values<Quote>(markets[s] || {}).map(q => ({ ...q, group: q.group ?? s })))
      .filter(q => Number.isFinite(q?.price) && Number.isFinite(q?.change_percent)),
    [markets],
  );
  const bySymbol = useMemo(() => new Map(allQuotes.map(q => [q.symbol, q])), [allQuotes]);
  const feedLoaded = Boolean(markets.timestamp || markets.error);

  const breadth = useMemo<MarketBreadth | null>(() => {
    if (!allQuotes.length) return null;
    const up = allQuotes.filter(q => q.change_percent > 0).length;
    const down = allQuotes.filter(q => q.change_percent < 0).length;
    const sorted = [...allQuotes].sort((a, b) => b.change_percent - a.change_percent);
    return { up, down, flat: allQuotes.length - up - down, total: allQuotes.length, best: sorted.slice(0, 5), worst: sorted.slice(-5).reverse() };
  }, [allQuotes]);

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

  /** A second click on the charted row unloads it. */
  const open = useCallback((q: { symbol: string }) => {
    setSelected(prev => (prev === q.symbol ? null : q.symbol));
  }, []);

  /** Load a security: chart it, and bring up the section that lists it. */
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
    else if (typed.trim()) setMiss(typed.trim().slice(0, 24));
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

  /** The rows for the section on screen, grouped by region on world indices. */
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
  // Full screen always has a chart up: the one loaded, else the first benchmark.
  const chartSymbol = selected ?? (maximized ? (bySymbol.has(PULSE[0].symbol) ? PULSE[0].symbol : allQuotes[0]?.symbol ?? null) : null);
  const chartQuote = chartSymbol ? bySymbol.get(chartSymbol) : undefined;

  return {
    watchlist, star, fn, setFn, current, selected, setSelected, open, sort, onSort,
    command, setCommand, pick, setPick, miss, setMiss, suggestions, run,
    allQuotes, bySymbol, feedLoaded, breadth, groups, rowCount, openCount, chartSymbol, chartQuote,
  };
}

export type MarketsState = ReturnType<typeof useMarkets>;
