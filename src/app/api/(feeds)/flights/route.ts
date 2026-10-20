
import { NextResponse } from 'next/server';
import { record } from '@takip/archive/recorder';
import { TAKIP_USER_AGENT } from '@/lib/core/net/user-agent';
import { classifyFlight } from './classify';
import { interferenceCells, navSamplesFrom } from './gnss-interference';
import { publishFlights } from './latest';
import {
  adsbLolLastAttempt, adsbLolTypeSnapshot, awaitAdsbLolTypeSnapshot, fetchAdsbLolMil, withAircraftType, type TypeSnapshot,
} from './adsb-lol';

export const maxDuration = 60;

// 30 regions covering every major aviation corridor at 250 nm radius.
// Focused on high-density airspace: US domestic, North Atlantic, Europe,
// Middle East hub, India, East Asia, SE Asia, Australia, South America.
const REGIONS = [
  // North America
  { lat: 39.8,  lon: -98.5 }, // Central US
  { lat: 41.0,  lon: -74.0 }, // Northeast (NYC/Boston/DC)
  { lat: 33.0,  lon: -84.0 }, // Southeast (Atlanta)
  { lat: 42.0,  lon: -88.0 }, // Midwest (Chicago)
  { lat: 30.0,  lon: -97.0 }, // Texas (Dallas/Houston)
  { lat: 47.0,  lon:-122.0 }, // Pacific Northwest (Seattle)
  { lat: 34.0,  lon:-118.0 }, // SoCal (LA)
  { lat: 45.0,  lon: -73.0 }, // Canada East (Montreal/Toronto)
  { lat: 49.0,  lon: -97.0 }, // Canada Prairies
  // Europe
  { lat: 50.0,  lon:  15.0 }, // Central Europe
  { lat: 51.5,  lon:  -1.0 }, // UK / Ireland
  { lat: 47.0,  lon:   2.0 }, // France / Alps
  { lat: 40.0,  lon:  -4.0 }, // Iberia
  { lat: 42.0,  lon:  13.0 }, // Italy / Adriatic
  { lat: 60.0,  lon:  15.0 }, // Scandinavia
  { lat: 52.0,  lon:  22.0 }, // Eastern Europe / Baltics
  { lat: 39.0,  lon:  35.0 }, // Turkey / Aegean
  // Middle East & South Asia
  { lat: 25.0,  lon:  45.0 }, // Arabian Gulf (Dubai/Riyadh)
  { lat: 22.0,  lon:  78.0 }, // India
  // East Asia & Pacific
  { lat: 35.0,  lon: 105.0 }, // China
  { lat: 35.0,  lon: 136.0 }, // Japan
  { lat: 37.0,  lon: 127.0 }, // Korea
  { lat: 13.0,  lon: 100.0 }, // SE Asia (Bangkok)
  { lat:  1.0,  lon: 104.0 }, // Singapore / Malacca Strait
  // Australia
  { lat:-25.0,  lon: 133.0 }, // Central Australia
  { lat:-33.0,  lon: 151.0 }, // Eastern Australia (Sydney)
  // Africa
  { lat:  0.0,  lon:  20.0 }, // Central Africa
  { lat:-26.0,  lon:  28.0 }, // South Africa
  // South America
  { lat:-15.0,  lon: -60.0 }, // Brazil Central
  { lat:-23.0,  lon: -46.0 }, // São Paulo / Rio
];

// adsb.fi and adsb.lol serve tar1090/ADSBexchange-v2 shaped rows without an
// API key, so classifyFlight() works on both unchanged. Here adsb.lol serves
// /v2/mil and /v2/type/{types} (see ./adsb-lol); /v2/all is 404, and its lat/lon
// query feeds the view instead (./nearby). Other providers this route used to fan out to:
//   api.airplanes.live  → 403 on every endpoint (now key-gated)
//   api.adsb.one/v2     → 403 (checked as a replacement, also unusable)
// Because both failure modes are silent (403 bodies are discarded, an empty
// ac[] is indistinguishable from quiet airspace), the fallback path degraded to
// zero aircraft without ever throwing. Provider counts are reported in the
// response now so the next feed to die is visible instead of silent.
const ADSB_MAX_DIST = 250; // nm — hard cap the provider enforces
const ADSBFI_BASE = 'https://opendata.adsb.fi/api/v2';
const ADSBFI_MIL = `${ADSBFI_BASE}/mil`;
const OPENSKY_STATES = 'https://opensky-network.org/api/states/all?extended=1';

// adsb.fi allows roughly one request per second and soft-throttles over that by
// returning 200 with an empty ac[] rather than 429, so a parallel fanout looks
// like it succeeded while returning nothing. The regional sweep is paced.
const ADSBFI_GAP_MS = 1100;

// adsb.fi serves /mil but returns 400 for /ladd, /pia and /squawk/{code},
// so the global type feeds collapse to the military one.
async function fetchAdsbFiRegion(lat: number, lon: number): Promise<any[]> {
  const url = `${ADSBFI_BASE}/lat/${lat}/lon/${lon}/dist/${ADSB_MAX_DIST}`;
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(12000),
      headers: { 'User-Agent': TAKIP_USER_AGENT },
    });
    if (res.ok) {
      const text = await res.text();
      record('adsbfi', { url, status: res.status }, text);
      return JSON.parse(text).ac || [];
    }
    record('adsbfi', { url, status: res.status }, null);
    await res.body?.cancel();
  } catch (e) {
    record('adsbfi', { url, status: 0, err: String(e) }, null);
  }
  return [];
}

let cachedData: any = null;
let lastFetchTime = 0;
// 90s TTL keeps us well within the authenticated OpenSky budget (4000 credits/day,
// 4 credits/call = 1000 calls/day ≈ one per 86s). The old 45s TTL at ~1920 calls/day
// was what got the VPS IP rate-limited on the anonymous pool.
const CACHE_TTL = 90000;

// OpenSky's budget is per day, not per request, so it needs its own interval
// separate from the response cache above. Authenticated it is 4000 credits/day
// and an unbounded /states/all costs 4, which is the 90s the TTL was built for.
// Anonymous it is only 400 credits/day — 100 calls, one per ~864s — so polling
// it on the same 90s TTL burns the whole day's budget in about half an hour,
// after which every call 429s and the route sits permanently in the cooldown
// branch below. That is what emptied the map: no credentials were configured,
// so the budget was gone and the feeds it fell back to were the dead ones above.
const hasOpenSkyCreds = () =>
  Boolean(process.env.OPENSKY_CLIENT_ID && process.env.OPENSKY_CLIENT_SECRET);
const openSkyInterval = () => Math.max(hasOpenSkyCreds() ? 90000 : 900000, openSkyPacedInterval);

// The budget is shared with anything else on the same account, or the same IP when anonymous: a
// second copy of the app, a laptop behind the same router. Spreading what OpenSky says is left over
// the rest of the UTC day slows down before the budget runs out, rather than 429ing for half of it.
const OPENSKY_CALL_CREDITS = 4;
const OPENSKY_MAX_PACE_MS = 15 * 60 * 1000;
let openSkyPacedInterval = 0;

function paceOpenSky(res: Response) {
  const header = res.headers.get('x-rate-limit-remaining');
  if (header === null || !Number.isFinite(Number(header))) return;
  const callsLeft = Math.floor(Number(header) / OPENSKY_CALL_CREDITS);
  const untilMidnight = 86_400_000 - (Date.now() % 86_400_000);
  openSkyPacedInterval = Math.min(OPENSKY_MAX_PACE_MS, callsLeft > 0 ? untilMidnight / callsLeft : OPENSKY_MAX_PACE_MS);
}

// The last good OpenSky snapshot is kept and reused between those calls. On the
// anonymous interval a refetch is only due every 15 minutes, and rebuilding the
// payload from adsb.fi alone in between would swing the map between ~10K
// aircraft and a few hundred every 90s. Reusing the snapshot keeps the aircraft
// on screen stable; only their age varies, which providers.opensky_age_s reports.
let osSnapshot: any[] = [];
let osSnapshotTime = 0;
let fetchPromise: Promise<any> | null = null;

// Back off from OpenSky after a 429 so the daily quota can reset.
// Re-poking a limited endpoint on every cache miss keeps the IP throttled.
let openSkyCooldownUntil = 0;
const OPENSKY_COOLDOWN = 15 * 60 * 1000; // 15 min

// OpenSky OAuth2 — optional but recommended for VPS deployments.
// Without keys: anonymous, works fine on residential IPs. VPS IPs can
// be throttled by OpenSky's anonymous per-IP pool. Setting these env
// vars bypasses the per-IP pool (account pool: 4000 credits/day).
let osToken: string | null = null;
let osTokenExpiry = 0;

async function getOpenSkyToken(): Promise<string | null> {
  const id = process.env.OPENSKY_CLIENT_ID;
  const secret = process.env.OPENSKY_CLIENT_SECRET;
  if (!id || !secret) return null;
  if (osToken && Date.now() < osTokenExpiry) return osToken;
  try {
    const res = await fetch(
      'https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ grant_type: 'client_credentials', client_id: id, client_secret: secret }),
        signal: AbortSignal.timeout(10000),
      }
    );
    if (!res.ok) { console.warn('[TAKIP] OpenSky token failed:', res.status); return null; }
    const data = await res.json();
    if (!data.access_token) {
      console.warn('[TAKIP] OpenSky token response missing access_token');
      return null;
    }
    osToken = data.access_token;
    osTokenExpiry = Date.now() + ((data.expires_in || 1800) - 60) * 1000;
    return osToken;
  } catch (e) {
    console.warn('[TAKIP] OpenSky token error:', e);
    return null;
  }
}

function ingestAc(raw: any[], into: any[], seen: Set<string>) {
  for (const ac of raw) {
    const hex = (ac.hex || '').toLowerCase().trim();
    if (hex && !seen.has(hex)) { seen.add(hex); into.push(ac); }
  }
}

export async function GET() {
  const now = Date.now();

  if (cachedData && now - lastFetchTime < CACHE_TTL) {
    return NextResponse.json(cachedData, {
      headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' },
    });
  }

  if (fetchPromise) {
    try {
      const data = await fetchPromise;
      return NextResponse.json(data, {
        headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' },
      });
    } catch {
      return NextResponse.json({ error: 'Failed to fetch flight data' }, { status: 500 });
    }
  }

  fetchPromise = (async () => {
    const allRaw: any[] = [];
    const seenHex = new Set<string>();
    let source: string;

    // ── Phase 1 + 2 in parallel: global military feed AND OpenSky simultaneously ──
    // Running them together keeps total wall-clock time to max(mil_feed, opensky)
    // instead of sum. The military feed runs every cycle regardless of OpenSky
    // status and is always current, so military traffic stays live even while an
    // anonymous OpenSky snapshot is waiting out its interval.
    const skipOpenSky =
      Date.now() < openSkyCooldownUntil ||
      Date.now() - osSnapshotTime < openSkyInterval();
    const token = skipOpenSky ? null : await getOpenSkyToken();
    const osInit: RequestInit = {
      signal: AbortSignal.timeout(30000),
      headers: { 'User-Agent': TAKIP_USER_AGENT, ...(token && { Authorization: `Bearer ${token}` }) },
    };

    // adsb.lol (ODbL) first; adsb.fi's /mil (non-commercial) only when it gives us nothing.
    const [lolMilRes, osRes] = await Promise.allSettled([
      fetchAdsbLolMil(),
      skipOpenSky
        ? Promise.reject(new Error('OpenSky in cooldown'))
        // extended=1 appends the ADS-B emitter category as an 18th field. Without
        // it the state vector is 17 long and s[17] below is silently undefined,
        // which is what made every category_os test in classifyFlight() dead.
        // It does not change the credit cost — that is set by the area queried.
        : fetch(OPENSKY_STATES, osInit),
    ]);

    const lolMil = lolMilRes.status === 'fulfilled' ? lolMilRes.value : null;
    if (lolMil) ingestAc(lolMil, allRaw, seenHex);
    const milRes = lolMil
      ? null
      : (await Promise.allSettled([fetch(ADSBFI_MIL, { signal: AbortSignal.timeout(15000), headers: { 'User-Agent': TAKIP_USER_AGENT } })]))[0];

    // Drain the adsb.fi fallback — parse on ok, discard the body otherwise to free the connection.
    if (milRes?.status === 'fulfilled') {
      if (milRes.value.ok) {
        try {
          const text = await milRes.value.text();
          record('adsbfi', { url: ADSBFI_MIL, status: milRes.value.status }, text);
          ingestAc(JSON.parse(text).ac || [], allRaw, seenHex);
        } catch (e) {
          console.warn('[TAKIP] adsb.fi mil parse error:', e);
        }
      } else {
        console.warn('[TAKIP] adsb.fi mil feed returned', milRes.value.status);
        record('adsbfi', { url: ADSBFI_MIL, status: milRes.value.status }, null);
        await milRes.value.body?.cancel();
      }
    } else if (milRes) {
      record('adsbfi', { url: ADSBFI_MIL, status: 0, err: String(milRes.reason) }, null);
    }
    const milCount = allRaw.length;

    // Refresh the OpenSky snapshot when one was due; otherwise the existing one
    // carries over untouched.
    if (osRes.status === 'fulfilled') {
      paceOpenSky(osRes.value);
      if (osRes.value.status === 429) {
        // OpenSky says how long until credits return; waiting less only spends 429s.
        const retryAfter = Number(osRes.value.headers.get('x-rate-limit-retry-after-seconds'));
        const cooldown = Number.isFinite(retryAfter) && retryAfter > 0 ? Math.min(retryAfter * 1000, 86_400_000) : OPENSKY_COOLDOWN;
        openSkyCooldownUntil = Date.now() + cooldown;
        console.warn(`[TAKIP] OpenSky 429 — cooling down ${Math.round(cooldown / 60000)} min`);
        record('opensky', { url: OPENSKY_STATES, status: 429 }, null);
        await osRes.value.body?.cancel();
      } else if (osRes.value.ok) {
        try {
          // The archive keeps the full state vectors, time_position and last_contact included.
          const text = await osRes.value.text();
          record('opensky', { url: OPENSKY_STATES, status: osRes.value.status }, text);
          const data = JSON.parse(text);
          const states = data.states || [];
          if (states.length > 100) {
            osSnapshot = states.map((s: any[]) => ({
              hex: s[0],
              flight: s[1]?.trim(),
              lon: s[5],
              lat: s[6],
              alt_baro: typeof s[7] === 'number' ? s[7] * 3.28084 : null,
              gs: typeof s[9] === 'number' ? s[9] * 1.94384 : null,
              track: s[10],
              squawk: s[14],
              category_os: s[17],
            }));
            osSnapshotTime = Date.now();
          }
        } catch (e) {
          console.warn('[TAKIP] OpenSky parse error:', e);
        }
      } else {
        // A rejected token surfaces here as a 401 — previously discarded silently.
        console.warn('[TAKIP] OpenSky returned', osRes.value.status);
        record('opensky', { url: OPENSKY_STATES, status: osRes.value.status }, null);
        await osRes.value.body?.cancel();
      }
    } else if (!skipOpenSky) {
      record('opensky', { url: OPENSKY_STATES, status: 0, err: String(osRes.reason) }, null);
    }

    // OpenSky's positions are fresher than the adsb.lol snapshot (up to 10 min old); adsb.lol adds the
    // aircraft type OpenSky never carries, plus the aircraft OpenSky does not have.
    let typed: TypeSnapshot | null = adsbLolTypeSnapshot();
    if (!typed && osSnapshot.length === 0) typed = await awaitAdsbLolTypeSnapshot();
    type TypedRow = { hex?: unknown; t?: unknown; r?: unknown; dbFlags?: unknown };
    const typedByHex = new Map<string, TypedRow>();
    for (const ac of (typed?.ac ?? []) as TypedRow[]) {
      const hex = String(ac?.hex ?? '').toLowerCase().trim();
      if (hex) typedByHex.set(hex, ac);
    }
    let typedMatched = 0;
    ingestAc(osSnapshot.map(row => {
      const t = typedByHex.get(String(row.hex ?? '').toLowerCase().trim());
      if (t) typedMatched++;
      return withAircraftType(row, t);
    }), allRaw, seenHex);
    const typedBefore = allRaw.length;
    if (typed) ingestAc(typed.ac, allRaw, seenHex);
    const typedAdded = allRaw.length - typedBefore;

    const openSkyWorked = osSnapshot.length > 0;
    const typedWorked = (typed?.ac.length ?? 0) > 1000;

    // ── Phase 3: Regional sweep — last resort only ────────────────────────────
    // Runs only when there is no OpenSky snapshot at all, never as the steady
    // state. adsb.fi's geographic endpoint is metered far more tightly than its
    // /mil feed and answers 200 with an empty ac[] once that budget is spent
    // rather than 429, so sweeping it every cycle would quietly exhaust it and
    // look like empty airspace. Paced at ~1 req/s; 30 regions ≈ 33s, inside the
    // 60s maxDuration above.
    if (!openSkyWorked && !typedWorked) {
      source = 'regional';
      console.warn('[TAKIP] no OpenSky snapshot — falling back to adsb.fi regional sweep');

      for (const r of REGIONS) {
        ingestAc(await fetchAdsbFiRegion(r.lat, r.lon), allRaw, seenHex);
        await new Promise(resolve => setTimeout(resolve, ADSBFI_GAP_MS));
      }

      if (allRaw.length === 0) {
        console.error(
          '[TAKIP] every flight provider returned zero aircraft — ' +
          'set OPENSKY_CLIENT_ID/OPENSKY_CLIENT_SECRET (free at opensky-network.org); ' +
          'the anonymous 400 credits/day pool cannot sustain a live map'
        );
      }
    } else if (openSkyWorked) {
      source = hasOpenSkyCreds() ? 'opensky-auth' : 'opensky-anon';
    } else {
      source = 'adsblol';
    }

    // ── Classify ──────────────────────────────────────────────────────────────
    const commercial: any[] = [];
    const privateFl: any[] = [];
    const jets: any[] = [];
    const military: any[] = [];

    for (const raw of allRaw) {
      const flight = classifyFlight(raw);
      if (!flight) continue;

      switch (flight.category) {
        case 'military': military.push(flight); break;
        case 'jet':      jets.push(flight);     break;
        case 'private':  privateFl.push(flight); break;
        default:         commercial.push(flight);
      }
    }

    return {
      commercial_flights: commercial,
      private_flights:    privateFl,
      private_jets:       jets,
      military_flights:   military,
      // adsb.* rows only: their position and accuracy are from the same moment, unlike a typed OpenSky row.
      gps_jamming:        interferenceCells(navSamplesFrom([...allRaw, ...(typed?.ac ?? [])])),
      total:              allRaw.length,
      source,
      // Per-feed counts so a provider that starts answering 200 with no aircraft
      // is visible in the payload rather than silently emptying the map.
      providers: {
        adsblol_mil:     lolMil ? milCount : 0,
        adsbfi_mil:      lolMil ? 0 : milCount,
        adsblol_typed:   typed?.ac.length ?? 0,
        adsblol_typed_matched: typedMatched,
        adsblol_typed_added:   typedAdded,
        adsblol_age_s:   typed ? Math.round((Date.now() - typed.at) / 1000) : null,
        // Batches never asked because an earlier one was refused are reported apart from the refusals.
        adsblol_batches: typed ? { answered: typed.answered, failed: typed.failed, refused: typed.refused, skipped: typed.skipped } : null,
        adsblol_last_attempt: adsbLolLastAttempt(),
        adsbfi_regional: openSkyWorked || typedWorked ? 0 : allRaw.length - milCount - typedAdded,
        opensky:         osSnapshot.length,
        opensky_auth:    hasOpenSkyCreds(),
        opensky_age_s:   osSnapshotTime ? Math.round((Date.now() - osSnapshotTime) / 1000) : null,
      },
      timestamp:          new Date().toISOString(),
    };
  })();

  try {
    const data = await fetchPromise;
    cachedData = data;
    lastFetchTime = Date.now();
    publishFlights(data);
    fetchPromise = null;
    return NextResponse.json(data, {
      headers: {
        'Cache-Control': data.total < 100 ? 'no-store, max-age=0' : 'public, s-maxage=30, stale-while-revalidate=60',
      },
    });
  } catch (error) {
    console.error('[TAKIP] Flight fetch error:', error);
    fetchPromise = null;
    // Stale-cache fallback: return last known good data instead of blank map
    if (cachedData) {
      console.warn('[TAKIP] Returning stale flight cache as fallback');
      return NextResponse.json({ ...cachedData, source: (cachedData.source || 'unknown') + '+stale' }, {
        headers: { 'Cache-Control': 'no-store, max-age=0' },
      });
    }
    return NextResponse.json({ error: 'Failed to fetch flight data' }, { status: 500 });
  }
}
