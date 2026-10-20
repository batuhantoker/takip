'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { DEFAULT_WIKI_LANGUAGE, getWikiLanguage, subscribeWikiLanguage } from '@/lib/core/wikipedia/language';
import type { WikiArticle } from '@/lib/core/wikipedia/summary';
import type { WikiTopic } from '@/lib/space/wiki-topic';

/** A Wikipedia lead and picture for a space-view topic, in the reader's Wikipedia when it has one; fetched once per topic and language. */
const cache = new Map<string, Promise<WikiArticle | null>>();

function load(t: WikiTopic, lang: string): Promise<WikiArticle | null> {
  const key = JSON.stringify([t, lang]);
  let p = cache.get(key);
  if (!p) {
    const qs = new URLSearchParams({ ...(t.title ? { title: t.title } : { q: t.q ?? '' }), lang });
    p = fetch(`/api/space/wiki?${qs}`).then(r => (r.ok ? r.json() as Promise<WikiArticle> : null)).catch(() => null);
    cache.set(key, p);
  }
  return p;
}

/** The Wikipedia picked in Settings, live. */
export const useWikiLanguage = () => useSyncExternalStore(subscribeWikiLanguage, getWikiLanguage, () => DEFAULT_WIKI_LANGUAGE);

export function useWiki(topic: WikiTopic | null): WikiArticle | null {
  const lang = useWikiLanguage();
  const key = topic ? JSON.stringify([topic, lang]) : '';
  const [state, setState] = useState<{ key: string; summary: WikiArticle | null }>({ key: '', summary: null });
  useEffect(() => {
    if (!key) return;
    let live = true;
    const [t, l] = JSON.parse(key) as [WikiTopic, string];
    load(t, l).then(summary => { if (live) setState({ key, summary }); });
    return () => { live = false; };
  }, [key]);
  return state.key === key ? state.summary : null;
}
