import { NextResponse } from 'next/server';
import WebSocket from 'ws';
import { record } from '@takip/archive/recorder';
import { shipCategory, type ShipCategory } from '@takip/core/vessel';
import { VesselRegistry, readRegistry, registryPath, writeRegistry } from '@/lib/feeds/maritime/vessel-registry';
import { CHOKEPOINTS, PORTS } from '@/lib/feeds/maritime/ports';
import { countNear, parseNear, type NearQuery } from '@/lib/feeds/maritime/ships-near';

/**
 * TAKIP — Maritime Intelligence
 * Real-time AIS vessel tracking via aisstream.io + Static global ports.
 */

// --- Global AIS Stream Client (In-Memory Cache) ---
// Note: In a true serverless environment, this state would reset per invocation.
// For Next.js dev server or Node.js Docker container, this will persist.

const MAX_SHIPS = 20_000;
const RECONNECT_MIN_MS = 5_000;
const RECONNECT_MAX_MS = 5 * 60_000;
const REGISTRY_SAVE_MS = 5 * 60_000;
// The global box carries ~90 frames/s, so a minute of silence means a dead socket.
const STALL_MS = 60_000;

export interface Ship {
  id: number;
  mmsi: number;
  timestamp: number;
  lat: number;
  lng: number;
  speed?: number;
  heading?: number;
  name?: string;
  destination?: string;
  type?: ShipCategory;
}

/** The subset of an aisstream.io frame this route reads. */
export interface AisFrame {
  error?: string;
  MessageType?: string;
  MetaData?: { MMSI?: number; ShipName?: string; latitude?: number; longitude?: number };
  Message?: {
    PositionReport?: { Latitude: number; Longitude: number; Sog: number; Cog: number; TrueHeading: number };
    ShipStaticData?: { Name?: string; Destination?: string; Type?: number };
  };
}

const globalForAis = globalThis as unknown as {
  shipsCache: Map<number, any>;
  aisSocket?: WebSocket | null;
  aisReconnectMs?: number;
  aisLastFrameAt?: number;
  vesselRegistry?: VesselRegistry;
  registrySaver?: ReturnType<typeof setInterval>;
};

if (!globalForAis.shipsCache) {
  globalForAis.shipsCache = new Map();
}

const shipsCache = globalForAis.shipsCache;

function persistRegistry(registry: VesselRegistry) {
  clearInterval(globalForAis.registrySaver);
  const path = registryPath();
  if (!path || process.env.NODE_ENV === 'test') return;
  // Merging keeps the fresher code, so codes another process (or a seed) wrote aren't overwritten.
  const merge = async () => registry.load(await readRegistry(path), Date.now());
  void merge();
  globalForAis.registrySaver = setInterval(async () => {
    if (!registry.dirty) return;
    await merge();
    writeRegistry(path, registry).catch(err => console.warn('[TAKIP] Could not save the AIS vessel registry:', err.message));
  }, REGISTRY_SAVE_MS).unref();
}

globalForAis.vesselRegistry ??= new VesselRegistry();
const vesselRegistry = globalForAis.vesselRegistry;
// A dev-server reload re-runs this module; restart the saver so it runs the reloaded code.
persistRegistry(vesselRegistry);

// Shared with the replay seal jobs, so history buckets vessels the same way the live map does.
export { shipCategory, type ShipCategory };

// AIS encodes "position not available" as lat 91 / lng 181.
const isValidPosition = (lat: unknown, lng: unknown) =>
  typeof lat === 'number' && typeof lng === 'number' && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;

/** Folds one aisstream.io message into the ship cache. */
export function applyAisMessage(cache: Map<number, Ship>, msg: AisFrame, now = Date.now(), registry = vesselRegistry): void {
  const meta = msg?.MetaData;
  const mmsi = meta?.MMSI;
  if (!mmsi) return;

  const ship: Partial<Ship> = cache.get(mmsi) ?? { id: mmsi, mmsi, timestamp: now };
  const metaName = typeof meta.ShipName === 'string' ? meta.ShipName.trim() : '';
  if (metaName) ship.name = metaName;

  const report = msg.MessageType === 'PositionReport' ? msg.Message?.PositionReport : null;
  const info = msg.MessageType === 'ShipStaticData' ? msg.Message?.ShipStaticData : null;

  if (report && isValidPosition(report.Latitude, report.Longitude)) {
    ship.lat = report.Latitude;
    ship.lng = report.Longitude;
    ship.speed = report.Sog;
    // 511 = no heading sensor.
    ship.heading = report.TrueHeading === 511 ? report.Cog : report.TrueHeading;
    ship.timestamp = now;
  } else if (info) {
    if (info.Name?.trim()) ship.name = info.Name.trim();
    if (info.Destination?.trim()) ship.destination = info.Destination.trim();
    ship.type = shipCategory(info.Type);
    if (typeof info.Type === 'number') registry.remember(mmsi, info.Type, now);
    // Static data can arrive before the first position report.
    if (ship.lat === undefined && isValidPosition(meta.latitude, meta.longitude)) {
      ship.lat = meta.latitude;
      ship.lng = meta.longitude;
    }
  }

  if (ship.type === undefined) {
    const code = registry.code(mmsi);
    if (code !== undefined) ship.type = shipCategory(code);
  }

  if (ship.lat === undefined || ship.lng === undefined) return;
  // Re-insert so Map order tracks recency and eviction drops the stalest ship.
  cache.delete(mmsi);
  cache.set(mmsi, ship as Ship);
  if (cache.size > MAX_SHIPS) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
}

function scheduleReconnect() {
  const delay = globalForAis.aisReconnectMs ?? RECONNECT_MIN_MS;
  // A rejected key closes the socket immediately; back off instead of hammering.
  globalForAis.aisReconnectMs = Math.min(delay * 2, RECONNECT_MAX_MS);
  setTimeout(connectAisStream, delay);
}

function connectAisStream() {
  // Reconnect timers from an earlier evaluation of this module can still fire.
  const current = globalForAis.aisSocket;
  if (current && (current.readyState === WebSocket.CONNECTING || current.readyState === WebSocket.OPEN)) return;

  const apiKey = process.env.AIS_API_KEY;
  if (!apiKey) {
    if (process.env.NODE_ENV !== 'test') {
      console.warn('[TAKIP] AIS_API_KEY is not set; live vessel tracking is off.');
    }
    return;
  }

  let ws: WebSocket;
  try {
    ws = new WebSocket("wss://stream.aisstream.io/v0/stream");
  } catch {
    scheduleReconnect();
    return;
  }
  globalForAis.aisSocket = ws;
  globalForAis.aisLastFrameAt = Date.now();

  // aisstream can go quiet without closing (e.g. across a laptop sleep), leaving an OPEN socket that never reconnects.
  const watchdog = setInterval(() => {
    if (Date.now() - (globalForAis.aisLastFrameAt ?? 0) < STALL_MS) return;
    console.warn('[TAKIP] AIS stream went quiet; reconnecting.');
    ws.terminate();
  }, STALL_MS / 4);

  ws.on("open", () => {
    const subscriptionMessage = {
      APIKey: apiKey,
      // Target specific high-value SCM areas to ensure data delivery on free tier
      BoundingBoxes: [
        // Tokyo Bay
        [[34.8, 139.5], [35.7, 140.2]],
        // Hormuz
        [[25.0, 54.0], [27.5, 57.5]],
        // Suez Canal
        [[27.0, 32.0], [32.0, 33.5]],
        // Bab el-Mandeb
        [[12.0, 42.5], [14.0, 44.0]],
        // Panama Canal
        [[8.0, -80.5], [10.0, -79.0]],
        // Malacca / Singapore
        [[1.0, 103.0], [3.0, 104.5]],
        // Taiwan Strait
        [[22.0, 118.0], [26.0, 121.0]],
        // Rotterdam / English Channel
        [[50.0, 0.0], [53.0, 5.0]],
        // US West Coast (LA/LB)
        [[33.0, -119.0], [34.5, -117.0]],
        // Global fallback (often heavily sampled by aisstream)
        [[-90, -180], [90, 180]]
      ],
      FilterMessageTypes: ["PositionReport", "ShipStaticData"]
    };
    ws.send(JSON.stringify(subscriptionMessage));
  });

  ws.on("message", (data) => {
    globalForAis.aisLastFrameAt = Date.now();
    const text = data.toString();
    let parsed: AisFrame;
    try {
      parsed = JSON.parse(text);
    } catch {
      return;
    }
    // One archive line per frame; AIS carries only our receive time.
    record('aisstream', {}, text);
    // aisstream reports a bad key or subscription as {"error": ...} and then closes.
    if (parsed?.error) {
      console.warn('[TAKIP] AIS stream rejected the subscription:', parsed.error);
      return;
    }
    globalForAis.aisReconnectMs = RECONNECT_MIN_MS;
    applyAisMessage(shipsCache, parsed);
  });

  ws.on("close", () => {
    clearInterval(watchdog);
    if (globalForAis.aisSocket === ws) globalForAis.aisSocket = null;
    scheduleReconnect();
  });

  // ws always follows 'error' with 'close', which does the reconnect.
  ws.on("error", (err) => {
    console.warn('[TAKIP] AIS stream error:', err.message);
  });
}

// A dev-server reload re-runs this module; swap the socket so frames reach the reloaded handlers.
globalForAis.aisSocket?.terminate();
connectAisStream();

// --- SCM Integration: VesselAPI Hybrid Fallback (Satellite AIS) ---
let lastVesselApiFetch = 0;
async function fetchVesselApiFallback() {
  // Mock data removed per user request. We only rely on real live stream data.
}

/* ── Response snapshot cache ──────────────────────────────────────────────
   The AIS websocket writes into shipsCache continuously, so a GET is pure
   aggregation over whatever that map happens to hold. Rebuilding it per
   request is what pins the CPU once the maritime layer gets popular: 58 ports
   and 10 chokepoints scanned against up to 20,000 ships is ~1.4M distance
   calculations, and the reply then serialises every one of those ships — a
   multi-megabyte JSON.stringify. At ~30 req/s that whole job runs thirty
   times a second to produce a byte-identical answer.

   Building it once per SNAPSHOT_TTL_MS and handing every caller the same
   pre-serialised string makes the cost independent of how many people are
   watching. The window sits well under the 10s the client polls at, so
   nothing reaches the map staler than it already was. */
const SNAPSHOT_TTL_MS = 5_000;
/** A ship not heard from for this long is dropped. */
const STALE_MS = 10 * 60_000;

const globalForSnapshot = globalThis as unknown as {
  maritimeSnapshot?: { body: string; builtAt: number };
};

function buildSnapshot(now: number): string {
  // Clean up stale ships (older than 10 minutes)
  for (const [mmsi, ship] of shipsCache.entries()) {
    if (now - ship.timestamp > STALE_MS) {
      shipsCache.delete(mmsi);
    }
  }

  const ships = Array.from(shipsCache.values());

  // Dynamically calculate live traffic (Fast approximation of Haversine)
  const getDistanceKm = (lat1: number, lng1: number, lat2: number, lng2: number) => {
    const dx = (lng1 - lng2) * Math.cos((lat1 + lat2) / 2 * Math.PI / 180);
    const dy = lat1 - lat2;
    return Math.sqrt(dx * dx + dy * dy) * 111.32;
  };

  const dynamicPorts = PORTS.map(port => {
    let nearbyCount = 0;
    let waitingCount = 0;

    for (let i = 0; i < ships.length; i++) {
      if (getDistanceKm(port.lat, port.lng, ships[i].lat, ships[i].lng) < 50) {
        nearbyCount++;
        // If speed is less than 0.5 knots, consider it anchored/waiting
        if (ships[i].speed < 0.5 && ships[i].type !== 'military') {
          waitingCount++;
        }
      }
    }

    // Heuristic: More than 40% waiting indicates congestion
    const congestionRatio = nearbyCount > 0 ? waitingCount / nearbyCount : 0;
    let congestionStatus = 'NORMAL';
    let estDwellTime = '1-2 Days';
    
    if (congestionRatio > 0.6 || waitingCount > 30) {
      congestionStatus = 'SEVERE';
      estDwellTime = '7+ Days';
    } else if (congestionRatio > 0.4 || waitingCount > 15) {
      congestionStatus = 'CONGESTED';
      estDwellTime = '3-5 Days';
    }

    return {
      ...port,
      volume: `${port.volume} | LIVE: ${nearbyCount} (WAITING: ${waitingCount})`,
      congestion: congestionStatus,
      dwell_time: estDwellTime
    };
  });

  const dynamicChokepoints = CHOKEPOINTS.map(choke => {
    let nearbyCount = 0;
    for (let i = 0; i < ships.length; i++) {
      if (getDistanceKm(choke.lat, choke.lng, ships[i].lat, ships[i].lng) < 100) nearbyCount++;
    }
    
    // Dynamically adjust risk based on live ship concentration
    let dynamicRisk = choke.risk;
    if (nearbyCount > 50) dynamicRisk = 'CRITICAL';
    else if (nearbyCount > 20 && dynamicRisk !== 'CRITICAL') dynamicRisk = 'HIGH';
    else if (nearbyCount > 5 && dynamicRisk === 'LOW') dynamicRisk = 'ELEVATED';

    return {
      ...choke,
      traffic: `${choke.traffic} | LIVE SHIPS: ${nearbyCount}`,
      risk: dynamicRisk
    };
  });

  return JSON.stringify({
    ports: dynamicPorts,
    chokepoints: dynamicChokepoints,
    ships: ships,
    total_ports: dynamicPorts.length,
    total_chokepoints: dynamicChokepoints.length,
    total_ships: ships.length,
    timestamp: new Date(now).toISOString(),
  });
}

/** Test seam — forces the next GET to rebuild. */
export function clearMaritimeSnapshot(): void {
  delete globalForSnapshot.maritimeSnapshot;
}

/** `?near=` asks for one count instead of every ship: a place page needs a line, not the ~3 MB snapshot. */
function nearReply(q: NearQuery, now: number): NextResponse {
  const fresh = Array.from(shipsCache.values()).filter(s => now - s.timestamp <= STALE_MS);
  return NextResponse.json({ near: countNear(fresh, q), timestamp: new Date(now).toISOString() }, {
    headers: { 'Cache-Control': `public, max-age=${SNAPSHOT_TTL_MS / 1000}, s-maxage=${SNAPSHOT_TTL_MS / 1000}, stale-while-revalidate=15` },
  });
}

export async function GET(request?: Request) {
  const near = request ? parseNear(new URL(request.url).searchParams) : null;
  if (near && 'error' in near) return NextResponse.json({ error: near.error }, { status: 400 });
  if (near) return nearReply(near, Date.now());

  // Trigger Hybrid Fallback
  await fetchVesselApiFallback();

  const now = Date.now();
  const cached = globalForSnapshot.maritimeSnapshot;

  const snapshot = cached && now - cached.builtAt < SNAPSHOT_TTL_MS
    ? cached
    : { body: buildSnapshot(now), builtAt: now };
  globalForSnapshot.maritimeSnapshot = snapshot;

  const maxAgeSeconds = Math.floor(SNAPSHOT_TTL_MS / 1000);

  return new NextResponse(snapshot.body, {
    headers: {
      'Content-Type': 'application/json',
      // The server would not have produced anything newer inside this window
      // either, so let the browser and any CDN in front of it skip the round
      // trip entirely rather than re-asking every 10s per open tab.
      'Cache-Control': `public, max-age=${maxAgeSeconds}, s-maxage=${maxAgeSeconds}, stale-while-revalidate=15`,
    },
  });
}
