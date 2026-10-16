'use client';

import { useEffect, useState } from 'react';
import type { WikiSummary } from '@/lib/core/wikipedia/summary';
import type { WikiTopic } from '@/lib/space/wiki-topic';

/** A Wikipedia lead and picture for a space-view topic, fetched once per topic for the session. */
const cache = new Map<string, Promise<WikiSummary | null>>();

function load(t: WikiTopic): Promise<WikiSummary | null> {
  const key = JSON.stringify(t);
  let p = cache.get(key);
  if (!p) {
    const qs = new URLSearchParams(t.title ? { title: t.title } : { q: t.q ?? '' });
    p = fetch(`/api/space/wiki?${qs}`).then(r => (r.ok ? r.json() as Promise<WikiSummary> : null)).catch(() => null);
    cache.set(key, p);
  }
  return p;
}

export function useWiki(topic: WikiTopic | null): WikiSummary | null {
  const key = topic ? JSON.stringify(topic) : '';
  const [state, setState] = useState<{ key: string; summary: WikiSummary | null }>({ key: '', summary: null });
  useEffect(() => {
    if (!key) return;
    let live = true;
    load(JSON.parse(key)).then(summary => { if (live) setState({ key, summary }); });
    return () => { live = false; };
  }, [key]);
  return state.key === key ? state.summary : null;
}
