import { Recorder } from '@takip/archive/recorder';
import { floorTo, HOUR_MS } from '@takip/core/time';

/*
 * OpenSky serves past state vectors to accounts only, and only up to an hour back
 * (openskynetwork.github.io/opensky-api/rest.html); anonymous requests ignore `time`. That is
 * enough to repair a short outage: a restart, a dropped connection. Lines go into the archive
 * as live ones would, filed under the hour they describe, so sealing reads them unchanged.
 */

const AUTH = 'https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token';
const STATES = 'https://opensky-network.org/api/states/all?extended=1';
const UA = 'TAKIP/0.1 (+https://github.com/batuhantoker/takip)';

/** The live route's cadence. */
const STEP_MS = 90_000;
/** The reach of authenticated history, less a minute so the first request isn't refused at the edge. */
const REACH_MS = HOUR_MS - 60_000;
/** Credits left for the live map: 250 calls. */
export const RESERVE_CREDITS = 1000;

type Deps = { get?: typeof fetch; now?: () => number; log?: (m: string) => void; env?: NodeJS.ProcessEnv };

export async function backfillOpenSky(archiveDir: string, from: number, to: number, { get = fetch, now = Date.now, log = console.log, env = process.env }: Deps = {}) {
  const id = env.OPENSKY_CLIENT_ID;
  const secret = env.OPENSKY_CLIENT_SECRET;
  if (!id || !secret) throw new Error('OpenSky history needs OPENSKY_CLIENT_ID and OPENSKY_CLIENT_SECRET: anonymous requests ignore `time`');
  const start = Math.max(from, now() - REACH_MS);
  const end = Math.min(to, now());
  if (start > from) log(`OpenSky only serves the last hour: starting at ${new Date(start).toISOString()}`);
  if (start >= end) return { calls: 0, hours: [] as number[] };

  const auth = await get(AUTH, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': UA },
    body: new URLSearchParams({ grant_type: 'client_credentials', client_id: id, client_secret: secret }),
  });
  const token = auth.ok ? ((await auth.json()) as { access_token?: string }).access_token : undefined;
  if (!token) throw new Error(`OpenSky token request failed (${auth.status})`);

  const rec = new Recorder({ dir: archiveDir, log });
  const hours = new Set<number>();
  let calls = 0;
  for (let t = start; t < end; t += STEP_MS) {
    const url = `${STATES}&time=${Math.floor(t / 1000)}`;
    const started = now();
    const res = await get(url, { headers: { Authorization: `Bearer ${token}`, 'User-Agent': UA } });
    const text = await res.text();
    rec.record('opensky', { at: now(), for: t, url, status: res.status, ms: now() - started }, res.ok ? text : null);
    hours.add(floorTo(t, HOUR_MS));
    calls++;
    if (!res.ok) {
      log(`stopped: OpenSky answered ${res.status}`);
      break;
    }
    const remaining = Number(res.headers.get('x-rate-limit-remaining'));
    if (Number.isFinite(remaining) && remaining < RESERVE_CREDITS) {
      log(`stopped with ${remaining} credits left, keeping them for the live map`);
      break;
    }
  }
  await rec.flush();
  return { calls, hours: [...hours].sort((a, b) => a - b) };
}
