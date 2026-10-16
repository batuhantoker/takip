import type { CctvCamera } from '@/lib/feeds/cameras/types';
import { createPool } from '@/lib/core/net/fetch-pool';

/**
 * TAKIP — flags cameras whose own host says they are off air, so the pin stays and says so instead of opening a dead player.
 * Only a definite "off" flags a camera: no answer, or one that can't be read, leaves it as it was.
 */

const UA = 'TAKIP/0.1 (+https://github.com/batuhantoker/takip)';
const BUDGET_MS = 6_000;
const FRESH_MS = 20 * 60_000;
// Per host, so one source's checks don't queue behind another's.
const pools = new Map<string, ReturnType<typeof createPool>>();

/** true is off air, false on air, null no usable answer. */
type Verdict = boolean | null;

interface Check {
  key: string;
  host: string;
  run: () => Promise<Verdict>;
}

// Checks that miss a budget still land here, for the next refresh to fall back on.
const known = new Map<string, { off: boolean; at: number }>();
const pending = new Map<string, Promise<Verdict>>();

const TVKUR_PLAYER = /^https:\/\/player\.tvkur\.com\/l\/([a-z0-9]+)$/;

function tvkurCheck(url: string): Check | null {
  const id = url.match(TVKUR_PLAYER)?.[1];
  if (!id) return null;
  return {
    key: `tvkur:${id}`,
    host: 'content.tvkur.com',
    run: async () => {
      // content.tvkur.com answers 403 without the embed's own Referer.
      const res = await fetch(`https://content.tvkur.com/l/${id}`, {
        headers: { 'User-Agent': UA, Accept: 'application/json', Referer: url },
        signal: AbortSignal.timeout(8_000),
      });
      const body = (await res.json().catch(() => null)) as { error?: unknown } | null;
      if (!body || typeof body !== 'object') return null;
      // "Live stream status is passive" or "Live stream not started yet."
      if (typeof body.error === 'string' && body.error) return true;
      return res.ok ? false : null;
    },
  };
}

// Sent instead of the player once an account's player.im subscription lapses; it is per account, so one ask covers all.
const PLAYER_IM_LAPSED = 'Playerinizi Güncelleyin';

function playerImCheck(url: string): Check | null {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  const uid = u.searchParams.get('uid');
  if (u.hostname !== 'play.player.im' || !u.pathname.endsWith('/playif.php') || !uid) return null;
  return {
    key: `player.im:${uid}`,
    host: u.hostname,
    run: async () => {
      const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(8_000) });
      return res.ok ? (await res.text()).includes(PLAYER_IM_LAPSED) : null;
    },
  };
}

function mediaCheck(cam: CctvCamera): Check | null {
  const url = cam.stream_url ?? cam.feed_url ?? '';
  let host: string;
  try {
    host = new URL(url).hostname;
  } catch {
    return null;
  }
  if (!url.startsWith('https://')) return null;
  return {
    key: `media:${url}`,
    host,
    run: async () => {
      const res = await fetch(url, { method: 'HEAD', headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(8_000) });
      return res.status === 404 ? true : res.ok ? false : null;
    },
  };
}

function settle(check: Check): Promise<Verdict> {
  const seen = known.get(check.key);
  if (seen && Date.now() - seen.at < FRESH_MS) return Promise.resolve(seen.off);
  let job = pending.get(check.key);
  if (!job) {
    let pool = pools.get(check.host);
    if (!pool) pools.set(check.host, (pool = createPool(4)));
    job = pool
      .run(check.run)
      .catch(() => null)
      .then(off => {
        if (off !== null) known.set(check.key, { off, at: Date.now() });
        return off;
      })
      .finally(() => pending.delete(check.key));
    pending.set(check.key, job);
  }
  return job;
}

async function markOff(cams: CctvCamera[], checkFor: (cam: CctvCamera) => Check | null): Promise<CctvCamera[]> {
  const checks = cams.map(checkFor);
  const verdicts = new Map<string, Verdict>();
  const jobs = checks.flatMap(c => (c ? [settle(c).then(off => void verdicts.set(c.key, off))] : []));
  if (!jobs.length) return cams;

  let timer: ReturnType<typeof setTimeout> | undefined;
  await Promise.race([Promise.all(jobs), new Promise<void>(resolve => { timer = setTimeout(resolve, BUDGET_MS); })]);
  clearTimeout(timer);

  return cams.map((cam, i) => {
    const c = checks[i];
    const off = c ? verdicts.get(c.key) ?? known.get(c.key)?.off ?? false : false;
    return off ? { ...cam, offline: true } : cam;
  });
}

/** tvkur and player.im embeds their host reports off air. Only those hosts are asked, so any list can pass through. */
export function markOfflineEmbeds(cams: CctvCamera[]): Promise<CctvCamera[]> {
  return markOff(cams, cam => {
    if (cam.stream_type !== 'iframe' || !cam.stream_url) return null;
    return tvkurCheck(cam.stream_url) ?? playerImCheck(cam.stream_url);
  });
}

/** Cameras whose stream (or still) answers 404: channels an operator lists but isn't running. One HEAD each, so small lists only. */
export function markMissingMedia(cams: CctvCamera[]): Promise<CctvCamera[]> {
  return markOff(cams, mediaCheck);
}

/** Test seam — forgets every verdict. */
export function clearLiveness(): void {
  known.clear();
  pending.clear();
}
