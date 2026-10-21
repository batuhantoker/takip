/**
 * GET one of this app's own /api routes from the server. Going over loopback rather than importing the
 * route keeps one copy of each route's cache: a second module copy would double the upstream calls.
 * Null on any failure, so a page just leaves its live line out.
 */
export async function ownApi<T>(path: string, revalidate: number): Promise<T | null> {
  try {
    const res = await fetch(`${ownOrigin()}${path}`, { next: { revalidate }, signal: AbortSignal.timeout(5_000) });
    return res.ok ? ((await res.json()) as T) : null;
  } catch {
    return null;
  }
}

/** This app, as the server reaches itself. */
export const ownOrigin = () => process.env.WEB_INTERNAL_URL?.replace(/\/+$/, '') || `http://127.0.0.1:${process.env.PORT || 3000}`;
