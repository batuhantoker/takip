import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export interface Tle {
  name: string;
  line1: string;
  line2: string;
}

/**
 * The web app's /api/satellites keeps this file current. Reading it spares CelesTrak, which rate-limits, a
 * second client. Resolved from this module, since the api runs with apps/api as its working directory.
 */
export const TLE_CACHE_FILE = fileURLToPath(new URL('../../../../../.next/cache/satellites-tle-cache.json', import.meta.url));

const TTL_MS = 5 * 60_000;
let cache: { at: number; byNorad: Map<string, Tle> } | null = null;

/** The NORAD id is columns 3-7 of line 1. */
const noradOf = (line1: string) => line1.substring(2, 7).trim();

/** Every TLE on disk by NORAD id, re-read at most every five minutes. */
export function tleCatalogue(): Map<string, Tle> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.byNorad;
  const byNorad = new Map<string, Tle>();
  try {
    if (existsSync(TLE_CACHE_FILE)) {
      const parsed = JSON.parse(readFileSync(TLE_CACHE_FILE, 'utf8')) as { sats?: Tle[] };
      for (const sat of parsed.sats ?? []) {
        if (sat?.line1 && sat?.line2) byNorad.set(noradOf(sat.line1), sat);
      }
    }
  } catch {
    // A corrupt file means no orbits, not a broken map: the client shows the satellite without its track.
  }
  cache = { at: Date.now(), byNorad };
  return byNorad;
}

/** Test seam: forget what was read. */
export function clearTleCatalogue() {
  cache = null;
}
