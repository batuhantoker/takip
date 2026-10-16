'use client';

import { useEffect, useState } from 'react';
import type { CraftHistory } from '@/lib/space/replay/flight-history';

/** One spacecraft's whole flight, fetched once per craft; the first time Horizons is asked, it takes a while. */
const cache = new Map<number, Promise<CraftHistory>>();

function load(id: number): Promise<CraftHistory> {
  let p = cache.get(id);
  if (!p) {
    p = fetch(`/api/space/history/${id}`).then(async r => {
      const body = await r.json().catch(() => null);
      if (!r.ok || !body) throw new Error(body?.error ?? `HTTP ${r.status}`);
      return body as CraftHistory;
    });
    // A failure is not remembered, so the next try asks again.
    p.catch(() => cache.delete(id));
    cache.set(id, p);
  }
  return p;
}

export function useFlightHistory(id: number | null): { history: CraftHistory | null; error: string | null } {
  const [state, setState] = useState<{ id: number | null; history: CraftHistory | null; error: string | null }>({ id: null, history: null, error: null });
  useEffect(() => {
    if (id === null) return;
    let live = true;
    load(id).then(
      history => { if (live) setState({ id, history, error: null }); },
      (e: Error) => { if (live) setState({ id, history: null, error: e.message }); },
    );
    return () => { live = false; };
  }, [id]);
  return state.id === id && id !== null ? { history: state.history, error: state.error } : { history: null, error: null };
}
