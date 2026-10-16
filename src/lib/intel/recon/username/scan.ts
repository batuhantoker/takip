/**
 * ═══════════════════════════════════════════════════════════════
 *  TAKIP — Username enumeration across social platforms
 *
 *  A TypeScript reimplementation of the detection logic from the Sherlock
 *  Project (MIT), driven by its site database:
 *    https://github.com/sherlock-project/sherlock
 *
 *  Sherlock itself is Python; shelling out to it is not an option in this
 *  runtime, but its data.json is the valuable part — 481 sites, each with
 *  the rule for deciding whether a profile exists. That rule set is what
 *  this module implements.
 *
 *  Three detection strategies, mirroring upstream:
 *    status_code    a non-error response means the profile exists
 *    message        the body of a missing profile contains a known string
 *    response_url   a missing profile redirects to a known URL
 * ═══════════════════════════════════════════════════════════════
 */

import { type SiteDef, loadSites, PRIORITY } from './sites';
import { type SiteResult, fill, checkSite } from './check';

export interface UsernameScan {
  username: string;
  checked: number;
  total_available: number;
  /** Positives that survived calibration — a control username was rejected. */
  found: SiteResult[];
  /** Sites that also claim a random control username exists, so their
   *  positive proves nothing. Reported separately rather than as hits. */
  inconclusive: SiteResult[];
  /** Sites that refused the request. Absence was NOT established here. */
  blocked: SiteResult[];
  /** Misses from sites that also miss their own known account, so the miss proves nothing. */
  unreliable: SiteResult[];
  not_found_count: number;
  errors: SiteResult[];
  skipped: SiteResult[];
  elapsed_ms: number;
  include_nsfw: boolean;
  verified: boolean;
  /** Most sites failed to connect at all: the network, not the sites, decided this scan. */
  network_trouble: boolean;
  source: string;
}

/** Guards against a username escaping the URL path it is substituted into. */
const SANE_USERNAME = /^[A-Za-z0-9._@-]{1,64}$/;

/** Bounded-concurrency map — a 481-site fan-out would exhaust the pool. */
export async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    for (;;) {
      const i = next++;
      if (i >= items.length) return;
      out[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return out;
}

/* ── entry point ─────────────────────────────────────────────── */

export interface ScanOptions {
  /** Check the whole database rather than the priority tier. */
  all?: boolean;
  includeNsfw?: boolean;
  limit?: number;
  concurrency?: number;
  timeoutMs?: number;
  /** Re-test positives against a random control username. On by default —
   *  without it roughly one in seven "hits" is a soft 404. */
  verify?: boolean;
  /** Called as each site answers, before calibration, so a caller can stream
   *  progress. `total` is the number of sites this scan will check. */
  onResult?: (result: SiteResult, total: number) => void;
  /** Stops scheduling further checks once aborted (the client went away). */
  signal?: AbortSignal;
  /** Read what each found page says about its owner (name, bio, links). */
  readPages?: boolean;
  /** Re-test misses on sites whose own known account goes unfound. On by default. */
  health?: boolean;
  /** Called once the sweep is done and hits are being re-tested. */
  onVerifying?: () => void;
}

/* ── site health ─────────────────────────────────────────────── */

/**
 * The control check catches sites that "find" everyone; this catches the
 * opposite. Sherlock lists an account each site is known to have
 * (`username_claimed`). A site that reports that account missing has a broken
 * rule or is quietly refusing us, and its "not found" for the real target is
 * worthless. Verdicts are cached, and each scan tests at most HEALTH_BUDGET
 * untested sites (the priority tier first), so the whole list is covered
 * over a few scans without making any one of them slow.
 */
const HEALTH_TTL = 12 * 60 * 60_000;
const HEALTH_BUDGET = 80;
const health = new Map<string, { broken: boolean; at: number }>();

async function brokenSites(
  db: Record<string, SiteDef>,
  missed: string[],
  opts: { concurrency: number; timeoutMs: number; signal?: AbortSignal },
): Promise<Set<string>> {
  const now = Date.now();
  const fresh = (n: string) => {
    const h = health.get(n);
    return !!h && now - h.at < HEALTH_TTL;
  };
  const priority = new Set(PRIORITY);
  const untested = missed
    .filter(n => db[n]?.username_claimed && !fresh(n))
    .sort((a, b) => Number(priority.has(b)) - Number(priority.has(a)))
    .slice(0, HEALTH_BUDGET);

  await mapLimit(untested, opts.concurrency, async n => {
    if (opts.signal?.aborted) return;
    const r = await checkSite(n, db[n], db[n].username_claimed!, opts.timeoutMs);
    // A refusal or timeout says nothing about the rule, so it isn't cached either way.
    if (r.status === 'found') health.set(n, { broken: false, at: Date.now() });
    else if (r.status === 'not_found') health.set(n, { broken: true, at: Date.now() });
  });

  return new Set(missed.filter(n => health.get(n)?.broken && fresh(n)));
}

/** A handle no one can plausibly hold, used to expose soft-404 sites. */
function controlUsername(length = 16): string {
  const letters = 'abcdefghijklmnopqrstuvwxyz';
  const chars = `${letters}0123456789`;
  let s = letters[Math.floor(Math.random() * letters.length)];
  for (let i = 1; i < length; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

/** A control the site's own username rules accept, so it is actually tried rather than skipped. */
function controlFor(def: SiteDef): string {
  if (!def.regexCheck) return controlUsername();
  try {
    const re = new RegExp(def.regexCheck);
    for (const length of [16, 12, 10, 8, 6]) {
      const c = controlUsername(length);
      if (re.test(c)) return c;
    }
  } catch {
    /* unusable pattern upstream */
  }
  return controlUsername();
}

export function isValidUsername(username: string): boolean {
  return SANE_USERNAME.test(username);
}

export async function scanUsername(username: string, opts: ScanOptions = {}): Promise<UsernameScan> {
  // Concurrency is deliberately modest: at 20 the scan was triggering the
  // sites' own rate limiters, and self-inflicted 429s look exactly like a
  // missing account unless treated as blocked.
  const {
    all = false, includeNsfw = false, limit, concurrency = 12, timeoutMs = 8000, verify = true,
    onResult, signal, readPages = false, health = true, onVerifying,
  } = opts;
  const started = Date.now();

  const db = await loadSites();
  let names = Object.keys(db);
  const totalAvailable = names.length;

  if (!includeNsfw) names = names.filter(n => !db[n].isNSFW);

  if (!all) {
    const priority = new Set(PRIORITY);
    const inTier = names.filter(n => priority.has(n));
    // Fall back to the head of the list if upstream renamed entries.
    names = inTier.length >= 20 ? inTier : names.slice(0, 60);
  }
  if (limit && limit > 0) names = names.slice(0, limit);

  const total = names.length;
  const results = await mapLimit(names, concurrency, async n => {
    if (signal?.aborted) {
      return { site: n, url: fill(db[n].url, username), status: 'skipped' as const, reason: 'scan cancelled', ms: 0 };
    }
    const r = await checkSite(n, db[n], username, timeoutMs, readPages);
    onResult?.(r, total);
    return r;
  });

  let found = results.filter(r => r.status === 'found').sort((a, b) => a.site.localeCompare(b.site));
  const inconclusive: SiteResult[] = [];
  if (!signal?.aborted) onVerifying?.();

  // Runs alongside the control check below; both only re-test what the sweep already answered.
  const brokenPromise = health && !signal?.aborted
    ? brokenSites(db, results.filter(r => r.status === 'not_found').map(r => r.site), { concurrency, timeoutMs, signal })
    : Promise.resolve(new Set<string>());

  /* Many sites answer 200 for a profile that does not exist, so a bare
     positive is not evidence. Re-run just the positives with a handle nobody
     can hold: any site that "finds" that one cannot be trusted for this scan.
     Only positives are re-tested, so the extra cost is small. */
  if (verify && found.length && !signal?.aborted) {
    /* Two independent controls, not one. With a single sample a soft-404 site
       can slip through whenever that particular control happens to be
       rejected — Roblox and WordPress passed for one handle while being
       flagged for another. A site is unreliable if *either* control lands. */
    const runControls = (sites: string[], rounds: number) =>
      mapLimit(
        sites.flatMap(site => Array.from({ length: rounds }, () => ({ site, control: controlFor(db[site]) }))),
        concurrency,
        p => checkSite(p.site, db[p.site], p.control, timeoutMs),
      );
    let controlResults = await runControls(found.map(r => r.site), 2);

    /* A control that was refused or timed out tested nothing. Those sites
       get one more go after a pause; a hit still untested after that stays
       found but is marked unverified, since the check never ran. */
    const settled = (results: SiteResult[]) => new Set(results.filter(c => c.status === 'not_found' || c.status === 'skipped' || c.status === 'found').map(c => c.site));
    const firstPass = settled(controlResults);
    const untested = found.map(r => r.site).filter(site => !firstPass.has(site));
    if (untested.length && !signal?.aborted) {
      await new Promise(r => setTimeout(r, 1500));
      controlResults = [...controlResults, ...(await runControls(untested, 1))];
    }

    const softFound = new Set(controlResults.filter(c => c.status === 'found').map(c => c.site));
    const tested = settled(controlResults);
    for (const r of found) {
      if (softFound.has(r.site)) {
        inconclusive.push({ ...r, status: 'inconclusive', reason: 'site also reports a random control username as present (soft 404)' });
      }
    }
    found = found
      .filter(r => !softFound.has(r.site))
      .map(r => (tested.has(r.site) ? r : { ...r, unverified: true, reason: 'not checked against a made-up handle: the site refused or timed out' }));
  }

  const broken = await brokenPromise;
  const unreliable = results
    .filter(r => r.status === 'not_found' && broken.has(r.site))
    .map(r => ({
      ...r,
      status: 'unreliable' as const,
      reason: `this site can’t find its own known account (${db[r.site].username_claimed}) either, so the miss proves nothing`,
    }));

  return {
    username,
    checked: results.length,
    total_available: totalAvailable,
    found,
    inconclusive,
    blocked: results.filter(r => r.status === 'blocked'),
    unreliable,
    not_found_count: results.filter(r => r.status === 'not_found').length - unreliable.length,
    errors: results.filter(r => r.status === 'error'),
    skipped: results.filter(r => r.status === 'skipped'),
    elapsed_ms: Date.now() - started,
    include_nsfw: includeNsfw,
    verified: verify,
    network_trouble: results.filter(r => r.status === 'error').length > results.length / 4,
    source: 'Sherlock Project site database (MIT)',
  };
}
