/**
 * TAKIP — TTL memo for whole-feed sources and per-key lookups.
 * Unlike cachedSource it keeps the last error, and after a failure it waits `retryMs` before trying
 * again, rather than refetching on every request. That matters for a host that hangs until timeout.
 * A failed refresh keeps serving the last good value.
 */

export interface Memoized<T> {
  /** False until one load has succeeded. */
  loaded: boolean;
  value: T | undefined;
  /** The latest refresh's error; with `loaded`, the value is from an earlier refresh. */
  error: string | null;
  fetchedAt: string | null;
}

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

export function memoSource<T>(load: () => Promise<T>, ttlMs: number, retryMs = 10 * 60_000): () => Promise<Memoized<T>> {
  const state: Memoized<T> = { loaded: false, value: undefined, error: null, fetchedAt: null };
  let nextAt = 0;
  let inflight: Promise<void> | null = null;

  return async () => {
    if (Date.now() >= nextAt) {
      inflight ??= load().then(
        value => {
          Object.assign(state, { loaded: true, value, error: null, fetchedAt: new Date().toISOString() });
          nextAt = Date.now() + ttlMs;
        },
        e => {
          state.error = message(e);
          nextAt = Date.now() + retryMs;
        },
      ).finally(() => { inflight = null; });
      await inflight;
    }
    return { ...state };
  };
}

/** One memo per key, oldest evicted past `maxKeys`. */
export function memoByKey<T>(load: (key: string) => Promise<T>, ttlMs: number, retryMs = 5 * 60_000, maxKeys = 300) {
  const memos = new Map<string, () => Promise<Memoized<T>>>();
  return (key: string): Promise<Memoized<T>> => {
    let memo = memos.get(key);
    if (!memo) {
      memo = memoSource(() => load(key), ttlMs, retryMs);
      memos.set(key, memo);
      if (memos.size > maxKeys) memos.delete(memos.keys().next().value as string);
    }
    return memo();
  };
}
