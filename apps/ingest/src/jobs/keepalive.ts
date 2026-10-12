/*
 * Phase 0: the live feeds still poll from inside the web app, and only when someone asks it to.
 * Asking on a schedule keeps the archive from having gaps shaped like visitor traffic, without a
 * second upstream poller (which would double the OpenSky quota). Goes away when connectors move here.
 */
const TARGETS: { path: string; everyMs: number; sources: string[] }[] = [
  // The route refetches once its 90 s cache expires; asking every minute keeps that at ≤ 150 s.
  { path: '/api/flights', everyMs: 60_000, sources: ['opensky', 'adsblol', 'adsbfi'] },
  // The AIS socket opens on the first request and stays open. A dev server restarts on every config
  // edit, and until something asks again no ship is recorded, so ask every minute.
  { path: '/api/maritime', everyMs: 60_000, sources: ['aisstream'] },
  // The route itself holds CelesTrak to one download per group per 2-hour update.
  { path: '/api/satellites', everyMs: 1_800_000, sources: ['celestrak'] },
  { path: '/api/cctv', everyMs: 1_800_000, sources: ['cctv'] },
];

/**
 * `recording(code)` reads the admin switches: a route whose sources are all switched off isn't asked,
 * since the Record switch alone stops archiving but not the upstream polling.
 */
export function startKeepalive(webUrl: string, recording: (source: string) => boolean, log: (message: string) => void): () => void {
  const failing = new Set<string>();
  const hit = async ({ path, sources }: (typeof TARGETS)[number]) => {
    if (!sources.some(recording)) return;
    try {
      const res = await fetch(new URL(path, webUrl), { signal: AbortSignal.timeout(90_000) });
      await res.body?.cancel();
      if (failing.delete(path)) log(`keepalive ${path} answering again`);
    } catch (error) {
      if (!failing.has(path)) log(`keepalive ${path} failed: ${(error as Error).message}`);
      failing.add(path);
    }
  };
  const timers = TARGETS.map(target => {
    void hit(target);
    return setInterval(() => void hit(target), target.everyMs);
  });
  return () => timers.forEach(clearInterval);
}
