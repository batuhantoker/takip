const KEY = 'takip.visitor';
const ID = /^[A-Za-z0-9_-]{16,64}$/;

/** A random id this browser keeps for usage statistics (apps/api map-time.ts); null where storage is blocked. */
export function visitorId(): string | null {
  try {
    const kept = localStorage.getItem(KEY);
    if (kept && ID.test(kept)) return kept;
    const id = Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, '0')).join('');
    localStorage.setItem(KEY, id);
    return id;
  } catch {
    return null;
  }
}

export type Arrival = { referrer: string | null; landing: string };

/** The other site that sent this page load, if any, and the address it landed on. */
export function arrival(): Arrival {
  let referrer: string | null = null;
  try {
    const host = new URL(document.referrer).hostname;
    if (host && host !== location.hostname) referrer = host;
  } catch {
    // No referrer, or not a URL.
  }
  return { referrer, landing: location.pathname + location.search };
}
