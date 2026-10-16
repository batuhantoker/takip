/**
 * When each live feed last landed in the page and when it last failed, by its URL path, so what
 * reads the data (TI's feed states) can tell live from stale, a fallback or a feed that is down.
 */

export interface FeedMark {
  /** When data last landed (ms), null before the first success. */
  at: number | null;
  failedAt: number | null;
  error?: string;
  /** The route's own `source` field, e.g. "opensky-anon" or "regional+stale". */
  source?: string;
  /** The route said its answer is a cached copy. */
  stale?: boolean;
  /** The data keys the last answer filled. */
  keys: string[];
}

const marks = new Map<string, FeedMark>();

export const feedPath = (url: string) => url.split('?')[0].split('#')[0];

const blank = (): FeedMark => ({ at: null, failedAt: null, keys: [] });

export function noteFeed(url: string, keys: string[], body: unknown, now = Date.now()): void {
  const b = body && typeof body === 'object' ? body as Record<string, unknown> : {};
  const prev = marks.get(feedPath(url)) ?? blank();
  marks.set(feedPath(url), {
    ...prev,
    at: now,
    keys,
    source: typeof b.source === 'string' ? b.source : undefined,
    stale: b.stale === true || undefined,
    // A 200 that names an error is a partial answer, not a failure.
    error: typeof b.error === 'string' ? b.error.slice(0, 160) : undefined,
  });
}

export function noteFeedFailure(url: string, error: string, now = Date.now()): void {
  const prev = marks.get(feedPath(url)) ?? blank();
  marks.set(feedPath(url), { ...prev, failedAt: now, error: error.slice(0, 160) });
}

export function feedMark(url: string): FeedMark | null {
  return marks.get(feedPath(url)) ?? null;
}

/** Every feed seen so far, by path. */
export function feedMarks(): Record<string, FeedMark> {
  return Object.fromEntries(marks);
}

/** For tests. */
export function resetFeedLog(): void {
  marks.clear();
}
