import { useEffect, useState } from 'react';
import { authClient } from '../auth-client';

/** GET /api/v1/me/time (apps/api/src/access/map-time.ts); `limit` 0 means no limit. */
export type MapTime = { limit: number; used: number; remaining: number; blocked: boolean; resetsAt: string };

const TICK_MS = 60_000;

async function ask(method: 'GET' | 'POST'): Promise<MapTime | null> {
  try {
    const res = await fetch('/api/v1/me/time', { method, cache: 'no-store' });
    return res.ok ? ((await res.json()) as MapTime) : null;
  } catch {
    return null;
  }
}

/** Today's map minutes: read on load and whenever the signed-in user changes, ticked once a minute while the tab is visible. */
export function useMapTime(): MapTime | null {
  const userId = authClient.useSession().data?.user.id ?? null;
  const [state, setState] = useState<{ userId: string | null; time: MapTime } | null>(null);

  useEffect(() => {
    let live = true;
    const update = (time: MapTime | null) => {
      if (live && time) setState({ userId, time });
    };
    void ask('GET').then(update);
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') void ask('POST').then(update);
    }, TICK_MS);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [userId]);

  return state?.userId === userId ? state.time : null;
}
