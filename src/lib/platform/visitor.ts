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

const ARRIVAL_KEY = 'takip.arrival';

/** The other site that sent this page load, if any. */
export function outsideReferrer(): string | null {
  try {
    const host = new URL(document.referrer).hostname;
    return host && host !== location.hostname ? host : null;
  } catch {
    return null; // No referrer, or not a URL.
  }
}

/**
 * Where this browser first came in: a public page notes it, so a reader who goes on to the map is counted as
 * sent by that page and the site before it, not as arriving at the map from nowhere.
 */
export function noteArrival() {
  try {
    if (!localStorage.getItem(ARRIVAL_KEY)) localStorage.setItem(ARRIVAL_KEY, JSON.stringify({ referrer: outsideReferrer(), landing: location.pathname }));
  } catch {
    // Storage blocked: the map reports its own arrival.
  }
}

/** The other site that sent this browser and the address it landed on: the first public page it read, or this load. */
export function arrival(): Arrival {
  try {
    const kept = JSON.parse(localStorage.getItem(ARRIVAL_KEY) ?? 'null') as Arrival | null;
    if (kept && typeof kept.landing === 'string') return { referrer: typeof kept.referrer === 'string' ? kept.referrer : null, landing: kept.landing };
  } catch {
    // Unreadable: fall back to this load.
  }
  return { referrer: outsideReferrer(), landing: location.pathname + location.search };
}
