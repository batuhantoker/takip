import { TAKIP_UA } from '@takip/connectors/http-json';
import type { Waypoint } from './trace';

const AUTH = 'https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token';
const TRACKS = 'https://opensky-network.org/api/tracks/all';

/**
 * Credits left alone for the live map, which polls /states/all on the same account (the Mac and the
 * NUC share it). ingest's OpenSky backfill keeps the same reserve. A track costs 4.
 */
export const RESERVE_CREDITS = 1000;
const COOLDOWN_MS = 15 * 60_000;
const DAY_MS = 86_400_000;

type Budget = { token: string | null; tokenUntil: number; day: number; remaining: number; coolUntil: number };
const fresh = (): Budget => ({ token: null, tokenUntil: 0, day: -1, remaining: Infinity, coolUntil: 0 });
let budget = fresh();

/** Forgets the token and what OpenSky said is left; for tests. */
export function resetOpenSkyTrack() {
  budget = fresh();
}

async function accessToken(id: string, secret: string, now: number): Promise<string | null> {
  if (budget.token && now < budget.tokenUntil) return budget.token;
  const res = await fetch(AUTH, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': TAKIP_UA },
    body: new URLSearchParams({ grant_type: 'client_credentials', client_id: id, client_secret: secret }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    await res.body?.cancel();
    return null;
  }
  const body = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!body.access_token) return null;
  budget.token = body.access_token;
  budget.tokenUntil = now + ((body.expires_in ?? 1800) - 60) * 1000;
  return budget.token;
}

/**
 * The flight in progress as OpenSky tracked it. Null when it isn't flying, when no account is set
 * (the anonymous pool is the live map's), or once the day's credits are down to the reserve.
 */
export async function fetchTrack(
  icao24: string,
  { env = process.env, now = Date.now() }: { env?: NodeJS.ProcessEnv; now?: number } = {},
): Promise<Waypoint[] | null> {
  const id = env.OPENSKY_CLIENT_ID;
  const secret = env.OPENSKY_CLIENT_SECRET;
  if (!id || !secret) return null;
  // Credits reset at midnight UTC.
  const day = Math.floor(now / DAY_MS);
  if (day !== budget.day) Object.assign(budget, { day, remaining: Infinity });
  if (now < budget.coolUntil || budget.remaining < RESERVE_CREDITS) return null;

  const token = await accessToken(id, secret, now);
  if (!token) return null;
  const res = await fetch(`${TRACKS}?icao24=${encodeURIComponent(icao24)}&time=0`, {
    headers: { Authorization: `Bearer ${token}`, 'User-Agent': TAKIP_UA, Accept: 'application/json' },
    signal: AbortSignal.timeout(12_000),
  });
  const left = res.headers.get('x-rate-limit-remaining');
  if (left !== null && Number.isFinite(Number(left))) budget.remaining = Number(left);
  if (!res.ok) {
    await res.body?.cancel();
    if (res.status === 401) budget.token = null;
    if (res.status === 429) {
      const wait = Number(res.headers.get('x-rate-limit-retry-after-seconds')) * 1000;
      budget.coolUntil = now + (Number.isFinite(wait) && wait > 0 ? wait : COOLDOWN_MS);
    }
    return null;
  }
  const body = (await res.json()) as { path?: Waypoint[] | null };
  return body.path ?? null;
}
