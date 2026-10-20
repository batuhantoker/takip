'use client';

import { useCallback, useEffect, useState } from 'react';
import { toStory, type StoryAlert } from '@/lib/intel/alerts/gdelt-alerts';

// GDELT publishes every 15 minutes.
const EVERY_MS = 15 * 60_000;
const FEED_URL = '/api/gdelt-events?limit=600';

/** Null when the route did not answer: the last good list stays. */
async function fetchStories(): Promise<StoryAlert[] | null> {
  try {
    const r = await fetch(FEED_URL);
    if (!r.ok) return null;
    const d = await r.json() as { events?: unknown[] };
    const now = Date.now();
    return (d.events ?? []).map(e => toStory(e, now)).filter((s): s is StoryAlert => s !== null);
  } catch {
    return null;
  }
}

/** GDELT's stories for the Alerts list, while the reader has them on. Undefined until the first answer. */
export function useGdeltStories(enabled: boolean) {
  const [stories, setStories] = useState<StoryAlert[] | undefined>(undefined);

  useEffect(() => {
    if (!enabled) return;
    let live = true;
    const load = () => fetchStories().then(s => { if (live && s) setStories(s); });
    load();
    const id = setInterval(() => { if (!document.hidden) load(); }, EVERY_MS);
    return () => { live = false; clearInterval(id); };
  }, [enabled]);

  const reload = useCallback(() => fetchStories().then(s => { if (s) setStories(s); }), []);

  return { stories: enabled ? stories : undefined, reload };
}
