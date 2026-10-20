'use client';

import { useEffect, useMemo } from 'react';
import { groupStatements, type AlertThread, type Bloc } from '@/lib/intel/alerts/digest';
import { urgency, type AlertItem, type NewsAlert, type QuakeAlert, type WarningAlert } from '@/lib/intel/alerts/live-alerts';
import type { StoryAlert } from '@/lib/intel/alerts/gdelt-alerts';
import { bucketOf, SEVERITY_GROUP } from '@/components/panels/alerts/format';

export type AlertTab = 'all' | 'news' | 'warnings' | 'quakes';
export type NewsKind = 'rocket' | 'breaking';

/** One line in the list: an alert with any near-copies folded under it, or a run of quotes from one speaker. */
export type AlertEntry =
  | { kind: 'item'; key: string; ts: number; item: AlertItem; similar: AlertItem[] }
  | { kind: 'statement'; key: string; ts: number; speaker: string; items: NewsAlert[] };

export type AlertGroup = { label: string; count: number; entries: AlertEntry[] };

const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

/* Issuers send the same warning once per district; channels repost word for word. */
function similarKey(item: AlertItem): string | null {
  if (item.kind === 'warning') return `w|${item.severity}|${norm(item.type)}|${norm(item.title)}|${norm(item.provider)}`;
  if (item.kind === 'news') return `n|${norm(item.title).slice(0, 120)}`;
  return null;
}

export function useAlertList({ tab, bloc, newsKind, q, activeThread, news, stories, quakes, warnings, now, onPinnedChange }: {
  tab: AlertTab;
  bloc: Bloc | 'all';
  newsKind: NewsKind | null;
  q: string;
  activeThread: AlertThread | null;
  news: NewsAlert[];
  /** GDELT's stories, already narrowed to what the reader asked for. */
  stories: StoryAlert[];
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
  // Stories have no side, thread or rocket kind, so those filters set them aside.
  const visibleStories = useMemo(
    () => (newsFiltersActive ? [] : stories.filter(s => !q || s.haystack.includes(q))),
    [stories, newsFiltersActive, q],
  );
  const visibleQuakes = useMemo(() => quakes.filter(k => !q || k.place.toLowerCase().includes(q)), [quakes, q]);
  const visibleWarnings = useMemo(() => warnings.filter(w => !q || w.haystack.includes(q)), [warnings, q]);

  const list: AlertItem[] = useMemo(() => {
    if (tab === 'news') return visibleStories.length ? [...visibleNews, ...visibleStories].sort((a, b) => b.ts - a.ts) : visibleNews;
    if (tab === 'warnings') return visibleWarnings;
    if (tab === 'quakes') return visibleQuakes;
    /* Thread and side filters are about reports, so warnings and quakes step
       aside while they apply. Only severe warnings join the mixed list: a few
       hundred lesser ones would bury the news. */
    if (newsFiltersActive) return visibleNews;
    return [...visibleNews, ...visibleStories, ...visibleQuakes, ...visibleWarnings.filter(w => w.severity === 'high')]
      .sort((a, b) => b.ts - a.ts || urgency(b) - urgency(a));
  }, [tab, visibleNews, visibleStories, visibleQuakes, visibleWarnings, newsFiltersActive]);

  /* The reports the filters leave showing that have a place: what the map pins. */
  const pinned = useMemo(
    () => (tab === 'quakes' ? [] : visibleNews.filter(n => n.place && n.coords)),
    [tab, visibleNews],
  );
  const pinnedKey = pinned.map(n => n.id).join(',');
  useEffect(() => {
    onPinnedChange?.(pinnedKey ? pinnedKey.split(',') : []);
  }, [pinnedKey, onPinnedChange]);

  const entries = useMemo<AlertEntry[]>(() => {
    const out: AlertEntry[] = [];
    const byKey = new Map<string, Extract<AlertEntry, { kind: 'item' }>>();
    const runs = groupStatements(list.map(item => ({
      item,
      // Only reports form statements; a unique source keeps the rest apart.
      source: item.kind === 'news' ? item.source : `${item.kind}:${item.id}`,
      title: item.kind === 'news' ? item.title : '',
      ts: item.ts,
    })));
    for (const run of runs) {
      if (run.speaker && run.items.length > 1) {
        out.push({ kind: 'statement', key: `stmt:${run.items[0].item.id}`, ts: run.items[0].ts, speaker: run.speaker, items: run.items.map(x => x.item as NewsAlert) });
        continue;
      }
      const item = run.items[0].item;
      const key = similarKey(item);
      const lead = key ? byKey.get(key) : undefined;
      if (lead) { lead.similar.push(item); continue; }
      const entry = { kind: 'item' as const, key: item.id, ts: item.ts, item, similar: [] };
      if (key) byKey.set(key, entry);
      out.push(entry);
    }
    return out;
  }, [list]);

  /* Warnings are listed gravest first, so they are headed by grade; heading a
     list by time that is not in time order splits one hour into several. */
  const groups = useMemo<AlertGroup[]>(() => {
    const out: AlertGroup[] = [];
    for (const entry of entries) {
      const item = entry.kind === 'item' ? entry.item : null;
      const label = tab === 'warnings' && item?.kind === 'warning' ? SEVERITY_GROUP[item.severity] : bucketOf(entry.ts, now);
      const size = entry.kind === 'statement' ? entry.items.length : 1 + entry.similar.length;
      const last = out[out.length - 1];
      if (last?.label === label) { last.entries.push(entry); last.count += size; } else out.push({ label, count: size, entries: [entry] });
    }
    return out;
  }, [entries, now, tab]);

  return { newsFiltersActive, list, pinned, groups };
}
