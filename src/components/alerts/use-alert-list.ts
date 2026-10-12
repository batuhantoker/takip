'use client';

import { useEffect, useMemo } from 'react';
import { groupStatements, type AlertThread, type Bloc } from '@/lib/alert-digest';
import {
  BUCKETS, BUILTIN_FEEDS, urgency, type AlertItem, type NewsAlert, type QuakeAlert, type Tab, type Unit, type WarningAlert,
} from '@/lib/live-alerts';

export function useAlertList({ tab, bloc, newsKind, q, activeThread, news, quakes, warnings, now, onPinnedChange }: {
  tab: Tab;
  bloc: Bloc | 'all';
  newsKind: 'rocket' | 'breaking' | null;
  q: string;
  activeThread: AlertThread | null;
  news: NewsAlert[];
  quakes: QuakeAlert[];
  warnings: WarningAlert[];
  now: number;
  onPinnedChange?: (ids: string[]) => void;
}) {
  const newsFiltersActive = Boolean(activeThread) || bloc !== 'all' || newsKind !== null;
  const threadIds = useMemo(() => (activeThread ? new Set(activeThread.itemIds) : null), [activeThread]);

  const visibleNews = useMemo(() => news.filter(n =>
    (!threadIds || threadIds.has(n.id))
    && (bloc === 'all' || n.bloc === bloc || n.carriers.some(c => c.bloc === bloc))
    && (newsKind === null || (newsKind === 'rocket' ? n.alertKind === 'rocket' : Boolean(n.flag)))
    && (!q || n.haystack.includes(q)),
  ), [news, threadIds, bloc, newsKind, q]);
  const visibleQuakes = useMemo(() => quakes.filter(k => !q || k.place.toLowerCase().includes(q)), [quakes, q]);
  const visibleWarnings = useMemo(() => warnings.filter(w => !q || w.haystack.includes(q)), [warnings, q]);
  const visibleFeeds = useMemo(() => BUILTIN_FEEDS.filter(f => !q || `${f.name} ${f.city} ${f.country} ${f.category}`.toLowerCase().includes(q)), [q]);

  const list: AlertItem[] = useMemo(() => {
    if (tab === 'news') return visibleNews;
    if (tab === 'warnings') return visibleWarnings;
    if (tab === 'quakes') return visibleQuakes;
    if (tab === 'feeds') return [];
    /* Thread and perspective filters are about reports; warnings and quakes
       step aside while they apply. In the mixed list a severe warning leads
       its hour, since that is the one a reader has to act on. Lesser grades
       stay on the warnings tab: a few hundred of them would bury the news. */
    if (newsFiltersActive) return visibleNews;
    return [...visibleNews, ...visibleQuakes, ...visibleWarnings.filter(w => w.severity === 'high')]
      .sort((a, b) => b.ts - a.ts || urgency(b) - urgency(a));
  }, [tab, visibleNews, visibleQuakes, visibleWarnings, newsFiltersActive]);

  /* The reports the filters leave showing that have a place — what the map pins. */
  const pinned = useMemo(
    () => (tab === 'quakes' || tab === 'feeds' ? [] : visibleNews.filter(n => n.place && n.coords)),
    [tab, visibleNews],
  );
  const pinnedKey = pinned.map(n => n.id).join(',');
  useEffect(() => {
    onPinnedChange?.(pinnedKey ? pinnedKey.split(',') : []);
  }, [pinnedKey, onPinnedChange]);

  const units = useMemo<Unit[]>(() => groupStatements(list.map(item => ({
    item,
    // Only reports form statements; a unique source keeps the rest apart.
    source: item.kind === 'news' ? item.source : `${item.kind}:${item.id}`,
    title: item.kind === 'news' ? item.title : '',
    ts: item.ts,
  }))).map((g): Unit => (g.speaker && g.items.length > 1
    ? { kind: 'statement', key: `stmt:${g.items[0].item.id}`, ts: g.items[0].ts, speaker: g.speaker, items: g.items.map(x => x.item as NewsAlert) }
    : { kind: 'item', key: g.items[0].item.id, ts: g.items[0].ts, item: g.items[0].item })), [list]);

  /* Headings follow the order the list is in: warnings are ranked by how grave
     they are, everything else by when it landed. Heading by time a list that
     is not in time order splits one hour into several headings. */
  const grouped = useMemo(() => {
    const severityLabel = { high: 'SEVERE', medium: 'MODERATE', low: 'ADVISORY' };
    const out: { label: string; units: Unit[] }[] = [];
    for (const unit of units) {
      const item = unit.kind === 'item' ? unit.item : null;
      const label = tab === 'warnings' && item?.kind === 'warning'
        ? severityLabel[item.severity]
        : BUCKETS.find(b => now - unit.ts < b.max)!.label;
      const last = out[out.length - 1];
      if (last?.label === label) last.units.push(unit);
      else out.push({ label, units: [unit] });
    }
    return out;
  }, [units, now, tab]);

  return { newsFiltersActive, visibleFeeds, list, pinned, grouped };
}
