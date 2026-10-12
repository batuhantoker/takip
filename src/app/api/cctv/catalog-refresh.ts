import { cachedSource, isStale, peekSource, seedSource } from '@/lib/sourceCache';
import { buildPayload, clearPayload, readSnapshot, writeSnapshot, type Payload, type RegionCameras } from '@/lib/cctv-snapshot';
import { createPool } from '@/lib/fetch-pool';
import { RAW_REGION_FETCHERS, type RegionFetcher } from './catalog-registry';

/**
 * Every region is served from the shared source cache.
 *
 * Six of these modules cached themselves and thirty-three did not, which meant
 * a request with no `region` refetched thirty-three upstreams live — several of
 * them megabytes, two of them long dead. Under real traffic that is one
 * outbound fetch storm per visitor. Caching here rather than in each module
 * means a source added later cannot forget to do it.
 */
export const REGION_FETCHERS: Record<string, RegionFetcher> = Object.fromEntries(
  Object.entries(RAW_REGION_FETCHERS).map(([region, fetcher]) => [
    region,
    cachedSource(`cctv:${region}`, fetcher),
  ]),
);

/**
 * A region that will not answer must not hold the other forty-seven hostage.
 * The abandoned fetch keeps running inside the cache, so the frame it was
 * fetching lands in time for the next request rather than being thrown away —
 * this drops a slow region from the current response, not from the map.
 */
const REGION_BUDGET_MS = 12_000;

/**
 * Regions are fetched a few at a time, not all forty-eight at once.
 *
 * Several regions fan out again to their own sub-sources, so the old
 * all-at-once dispatch opened well over sixty simultaneous connections and
 * the upstreams started failing on connect. Every host that timed out that
 * way answered in under a second when asked on its own, and because a failed
 * region caches empty for a minute, one storm kept the same regions missing
 * from response after response. Queued regions still run; they just wait
 * their turn, and whatever misses the deadline lands in the cache for the
 * next caller.
 */
/**
 * How long a response waits on regions it does not already have.
 *
 * A catalogue that already holds 35,000 cameras must not be held hostage by
 * one upstream that hangs. us-central does exactly that — it burns the full
 * slot budget on every attempt — and waiting on it turned a 0.2s response
 * into a 12s one for every visitor, which is what made the cameras take so
 * long to appear. With cameras already in hand, wait only briefly for the
 * stragglers and let the rest land in the cache for the next caller. With
 * nothing in hand there is nothing to show anyway, so a cold start still
 * waits properly rather than returning an empty map.
 */
const WARM_GRACE_MS = 2_000;

const REGION_CONCURRENCY = 4;
const regionPool = createPool(REGION_CONCURRENCY);

/**
 * Regions whose upstream is timing out or returning empty get a cooldown so
 * they stop burning pool slots every 60 seconds.  The cooldown is lifted once
 * the backoff window expires, letting the next scheduled refresh try again.
 */
const BACKOFF_MS = 5 * 60 * 1000; // 5 minutes
const backedOff = new Map<string, number>();

/**
 * One refresh per region at a time, and never an unbounded slot.
 *
 * A pool slot held by an upstream that never answers is worse than the storm
 * it replaced: four of those and the catalogue stops refreshing entirely. The
 * budget guarantees the slot comes back. The abandoned fetch keeps running
 * inside the source cache, where it costs no slot and still lands for the
 * next caller. Sharing one refresh per region also stops a hundred
 * simultaneous visitors queueing a hundred copies of the same work.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const refreshing = new Map<string, Promise<any[]>>();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function refreshRegion(region: string): Promise<any[]> {
  /* If this region recently timed out, skip it entirely until the backoff
     window expires.  This stops a down upstream from burning a pool slot
     every 60s and clogging the event loop with 12s waits. */
  const cooldownUntil = backedOff.get(region);
  if (cooldownUntil && Date.now() < cooldownUntil) {
    return Promise.resolve([]);
  }

  const existing = refreshing.get(region);
  if (existing) return existing;

  const started = regionPool.run(async () => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let timedOut = false;
    try {
      return await Promise.race([
        REGION_FETCHERS[region](),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        new Promise<any[]>(resolve => {
          timer = setTimeout(() => {
            timedOut = true;
            console.warn(`[OSIRIS] cctv:${region} over ${REGION_BUDGET_MS}ms — backing off for 300s`);
            backedOff.set(region, Date.now() + BACKOFF_MS);
            resolve([]);
          }, REGION_BUDGET_MS);
        }),
      ]);
    } finally {
      clearTimeout(timer);
      /* If the fetch succeeded (did not time out), clear any lingering backoff
         so a recovered upstream is used immediately. */
      if (!timedOut) backedOff.delete(region);
    }
  }).finally(() => { refreshing.delete(region); });

  refreshing.set(region, started);
  return started;
}

export const ALL_REGIONS = () => Object.keys(REGION_FETCHERS);

/** Everything currently held, stale included — what gets written to disk. */
function currentRegions(): RegionCameras {
  const regions: RegionCameras = {};
  for (const region of ALL_REGIONS()) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cameras = peekSource<any>(`cctv:${region}`, true);
    if (cameras?.length) regions[region] = cameras;
  }
  return regions;
}

/** Serialise and compress the whole-world response once, not per request. */
export function rebuildPayload(): Payload | undefined {
  const regions = currentRegions();
  const held = Object.keys(regions);
  if (!held.length) return undefined;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cameras: any[] = [];
  const sources: Record<string, number> = {};
  for (const region of ALL_REGIONS()) {
    for (const camera of regions[region] ?? []) {
      cameras.push(camera);
      const label = String(camera.source ?? 'unknown');
      sources[label] = (sources[label] || 0) + 1;
    }
  }
  return buildPayload({
    cameras,
    total: cameras.length,
    sources,
    regions: ALL_REGIONS(),
    pendingRegions: ALL_REGIONS().filter(region => !regions[region]),
    timestamp: new Date().toISOString(),
  }, cameras.length, held.length === ALL_REGIONS().length);
}

const PERSIST_EVERY_MS = 60_000;
let lastPersistedAt = 0;
let lastPersistedTotal = 0;

/**
 * Saves only ever move forwards.
 *
 * A boot that starts empty reaches its first request with a handful of
 * cameras, and writing that would replace a good saved catalogue with a
 * near-empty one — the next boot would then restore almost nothing. The
 * restore seeds the high-water mark, so a fresh process cannot regress what
 * an earlier one already learned.
 */
export async function persistCatalogue() {
  const cameras = Object.values(currentRegions()).reduce((n, list) => n + list.length, 0);
  if (cameras <= lastPersistedTotal) return;
  if (Date.now() - lastPersistedAt < PERSIST_EVERY_MS) return;
  lastPersistedAt = Date.now();
  lastPersistedTotal = cameras;
  try {
    await writeSnapshot(currentRegions());
  } catch (error) {
    console.warn('[OSIRIS] Could not save the camera catalogue:', error);
  }
}

/**
 * Fill the catalogue before the first visitor arrives, rather than because of
 * one. Without this the first request after a deploy pays the whole cold
 * fan-out and still returns a partial map; with it the pool has usually
 * finished by the time anyone asks. Called from instrumentation at boot.
 */
let restoring: Promise<void> | undefined;

/**
 * Load the saved catalogue into this module, once.
 *
 * The request handler owns this rather than the boot hook: Next loads
 * instrumentation in its own module graph, so a catalogue restored there
 * populated a different copy of these caches and every request still started
 * from nothing. Reading ~2MB from disk costs a few milliseconds and makes the
 * first request as fast as the thousandth.
 */
export function ensureRestored(): Promise<void> {
  restoring ??= (async () => {
    const saved = await readSnapshot();
    if (!saved) return;
    let cameras = 0;
    for (const [region, list] of Object.entries(saved.regions)) {
      if (region in REGION_FETCHERS) { seedSource(`cctv:${region}`, list); cameras += list.length; }
    }
    rebuildPayload();
    lastPersistedTotal = cameras;
    console.log(`[OSIRIS] Camera catalogue restored: ${cameras} cameras from disk`);
  })().catch(error => { console.warn('[OSIRIS] Could not restore the camera catalogue:', error); });
  return restoring;
}

export async function warmCctvCatalog() {
  await ensureRestored();
  // Then bring it up to date, and save whatever it became.
  await collectRegions(ALL_REGIONS());
  rebuildPayload();
  await persistCatalogue();
}

/** Test seam — drops queued refreshes between cases. */
export function clearCctvRefreshes() {
  refreshing.clear();
  regionPool.reset();
  restoring = undefined;
  clearPayload();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function collectRegions(regions: string[]): Promise<{ cameras: Record<string, any[]>; pending: string[] }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cameras: Record<string, any[]> = {};
  const missing: string[] = [];

  for (const region of regions) {
    /* Stale cameras beat no cameras: a camera index goes out of date over
       weeks, so serving yesterday's positions while today's are fetched is
       always the better trade. The refresh runs behind the response. */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cached = peekSource<any>(`cctv:${region}`, true);
    if (cached) {
      cameras[region] = cached;
      if (isStale(`cctv:${region}`)) void refreshRegion(region).catch(() => {});
    } else {
      missing.push(region);
    }
  }
  if (!missing.length) return { cameras, pending: [] };

  const fetches = missing.map(region => refreshRegion(region)
    .then(result => { if (result.length) cameras[region] = result; })
    .catch(() => { /* the cache logs it and keeps the last good index */ }));

  const budget = Object.keys(cameras).length ? WARM_GRACE_MS : REGION_BUDGET_MS;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<void>(resolve => { timer = setTimeout(resolve, budget); });
  await Promise.race([Promise.all(fetches), deadline]);
  clearTimeout(timer);

  const pending = missing.filter(region => !cameras[region]);
  if (pending.length) console.warn(`[OSIRIS] cctv still filling: ${pending.join(", ")}`);
  return { cameras, pending };
}

/** How old the prebuilt world payload may get before a rebuild is kicked off. */
export const PAYLOAD_REFRESH_MS = 5 * 60 * 1000;
const REBUILD_DELAY_MS = 2_000;
let rebuilding: Promise<void> | undefined;

export function rebuildInBackground() {
  rebuilding ??= (async () => {
    /* Let the response that triggered this reach the client first. Refreshing
       48 regions is heavy, single-threaded work, and starting it inline made
       the first request after a restart take 13s to flush a payload that was
       already built and sitting in memory. */
    await new Promise(resolve => setTimeout(resolve, REBUILD_DELAY_MS));
    await collectRegions(ALL_REGIONS());
    rebuildPayload();
    await persistCatalogue();
  })().catch(error => { console.warn('[OSIRIS] Camera catalogue rebuild failed:', error); })
    .finally(() => { rebuilding = undefined; });
  return rebuilding;
}
