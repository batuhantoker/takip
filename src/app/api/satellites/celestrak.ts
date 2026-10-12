import { record } from '@takip/archive/recorder';

/*
 * CelesTrak downloads under its usage policy (celestrak.org/usage-policy.php, May 2026): GP data
 * updates every 2 hours and a repeat download inside that window is refused with a 403; 50 HTTP
 * errors in 2 hours, or over 100 MB a day, end in the firewall; and software must stop on any
 * non-200 rather than retry. The old route asked for 45 groups every hour, which broke all three.
 */

const CT = 'https://celestrak.org/NORAD/elements/gp.php?GROUP=';

/**
 * `active` holds every payload in orbit, so its subsets (gps-ops, starlink, military, …) only
 * re-download the same objects. What it leaves out: the rocket bodies among the brightest
 * objects, and the big debris fields.
 */
export const CELESTRAK_GROUPS = ['active', 'visual', 'fengyun-1c-debris', 'iridium-33-debris', 'cosmos-2251-debris']
  .map(group => `${CT}${group}&FORMAT=tle`);

export const UPDATE_MS = 2 * 60 * 60_000;
/** After a refusal we can't explain. CelesTrak wants a person to look before anything retries. */
export const PAUSE_MS = 6 * 60 * 60_000;
export const USER_AGENT = 'TAKIP/0.1 (+https://github.com/batuhantoker/takip)';

export type Tle = { name: string; line1: string; line2: string };

/** Persisted with the TLE cache, so a restart never downloads a group twice in one update window. */
export type Schedule = { lastAttempt: Record<string, number>; gone: string[]; pausedUntil: number };

export const emptySchedule = (): Schedule => ({ lastAttempt: {}, gone: [], pausedUntil: 0 });

export function dueGroups(schedule: Schedule, now: number): string[] {
  if (now < schedule.pausedUntil) return [];
  return CELESTRAK_GROUPS.filter(url => !schedule.gone.includes(url) && now - (schedule.lastAttempt[url] ?? -Infinity) >= UPDATE_MS);
}

/** Raw two- or three-line element sets into named records. */
export function parseTleText(text: string): Tle[] {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  const sats: Tle[] = [];
  let i = 0;
  while (i < lines.length - 1) {
    if (!lines[i].startsWith('1') && lines[i + 1]?.startsWith('1') && lines[i + 2]?.startsWith('2')) {
      sats.push({ name: lines[i].replace(/^0\s+/, '').trim(), line1: lines[i + 1], line2: lines[i + 2] });
      i += 3;
    } else if (lines[i].startsWith('1') && lines[i + 1]?.startsWith('2')) {
      sats.push({ name: `SAT-${lines[i].substring(2, 7).trim()}`, line1: lines[i], line2: lines[i + 1] });
      i += 2;
    } else {
      i++;
    }
  }
  return sats;
}

type Deps = { fetch?: typeof fetch; now?: () => number; log?: (message: string) => void };

/**
 * Downloads the due groups one at a time and returns those with new data. "Not updated since"
 * means keep what we have; a 404 retires that group; any other refusal pauses every download.
 * Mutates `schedule`, which the caller persists.
 */
export async function downloadDue(schedule: Schedule, { fetch: get = fetch, now = Date.now, log = console.warn }: Deps = {}) {
  const fresh = new Map<string, Tle[]>();
  for (const url of dueGroups(schedule, now())) {
    const started = now();
    schedule.lastAttempt[url] = started;
    let res: Response;
    try {
      res = await get(url, { signal: AbortSignal.timeout(30_000), cache: 'no-store', headers: { 'User-Agent': USER_AGENT } });
    } catch (error) {
      record('celestrak', { url, status: 0, ms: now() - started, err: String(error) }, null);
      // Not a refusal CelesTrak sees, but no reason to try the rest right now either.
      break;
    }
    const text = await res.text().catch(() => '');
    const ms = now() - started;
    if (res.ok) {
      // Every element set we see is kept: orbit history is rebuilt from the archive.
      record('celestrak', { url, status: res.status, ms }, text, 'text');
      const sats = parseTleText(text);
      if (sats.length) fresh.set(url, sats);
      continue;
    }
    record('celestrak', { url, status: res.status, ms, err: text.slice(0, 300) }, null);
    if (res.status === 403 && text.includes('has not updated since')) continue;
    if (res.status === 404 || res.status === 301) {
      schedule.gone.push(url);
      log(`[satellites] CelesTrak answers ${res.status} for ${url}; dropping that group until the list is updated`);
      continue;
    }
    schedule.pausedUntil = now() + PAUSE_MS;
    log(`[satellites] CelesTrak refused ${url} with ${res.status} (${text.slice(0, 200)}); pausing all CelesTrak downloads for 6 h. Their policy asks a person to look before retrying.`);
    break;
  }
  return fresh;
}
