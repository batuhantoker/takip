import { describe, it, expect } from 'vitest';
import { fetchGdeltEvents } from './gdeltEvents';

/**
 * Live integration test — opt in with RUN_LIVE_TESTS=1 (hits the real GDELT
 * export host).
 *
 * data.gdeltproject.org now 301s every plain-HTTP request to its HTTPS origin,
 * including the http:// archive URLs printed in its own lastupdate.txt. The
 * reader follows redirects by re-entering itself, so an http-only client threw
 * `Protocol "https:" not supported` on the very first hop and the whole layer
 * went dark behind a 502. Nothing in a unit test would have caught that — it is
 * a fact about someone else's server, so it needs a real request to assert.
 */
const liveIt = process.env.RUN_LIVE_TESTS === '1' ? it : it.skip;

describe('fetchGdeltEvents', () => {
  liveIt('follows the http -> https redirect and returns geocoded events', async () => {
    const { events, windows, stats } = await fetchGdeltEvents({ limit: 50 });

    expect(windows[0]).toMatch(/^\d{14}$/);
    // The translated feed is optional: the reader carries on without it.
    for (const w of windows.slice(1)) expect(w).toMatch(/^\d{14}(\.translation)?$/);
    expect(stats.rows).toBeGreaterThan(0);
    expect(events.length).toBeGreaterThan(0);
    expect(events.length).toBeLessThanOrEqual(50);

    for (const e of events) {
      expect(Number.isFinite(e.lat) && Number.isFinite(e.lng)).toBe(true);
      expect(Math.abs(e.lat)).toBeLessThanOrEqual(90);
      expect(Math.abs(e.lng)).toBeLessThanOrEqual(180);
      // Null island is the ungeocoded artefact the reader is meant to drop.
      expect(e.lat === 0 && e.lng === 0).toBe(false);
    }
  }, 60_000);

  liveIt('honours the family filter', async () => {
    const { events } = await fetchGdeltEvents({ families: ['violence'], minReports: 1, limit: 25 });

    expect(events.length).toBeGreaterThan(0);
    for (const e of events) expect(e.family).toBe('violence');
  }, 60_000);
});
