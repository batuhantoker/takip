/**
 * OSIRIS — Flight Route API
 * 
 * Resolves a flight callsign or ICAO24 hex to its origin/destination airports,
 * coordinates, and estimated departure/arrival times.
 *
 * Data sources:
 *   1. ADSBDB (api.adsbdb.com) — free, no key needed — callsign → route
 *   2. HexDB (hexdb.io) — free fallback — callsign → route
 *   3. Embedded airport database — ICAO/IATA → lat/lng
 *
 * Usage: GET /api/flight-route?callsign=AAL100&icao24=abc123&lat=40.6&lng=-73.7&alt=10000&speed=450
 */

import { NextRequest, NextResponse } from 'next/server';
import { lookupAirport, type Airport } from '@/lib/airports';
import { stealthFetch } from '@/lib/stealthFetch';

export const maxDuration = 30;

// Simple in-memory cache to avoid hammering ADSBDB on rapid clicks
const routeCache = new Map<string, { data: any; ts: number }>();
const ROUTE_CACHE_TTL = 5 * 60 * 1000; // 5 min

/**
 * Compute great-circle distance between two points in km.
 */
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Generate intermediate points along a great-circle arc for smooth rendering.
 * Returns an array of [lng, lat] pairs (GeoJSON coordinate order).
 */
function greatCirclePoints(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
  numPoints: number = 64
): [number, number][] {
  const toRad = (d: number) => d * Math.PI / 180;
  const toDeg = (r: number) => r * 180 / Math.PI;

  const φ1 = toRad(lat1), λ1 = toRad(lng1);
  const φ2 = toRad(lat2), λ2 = toRad(lng2);

  const d = 2 * Math.asin(Math.sqrt(
    Math.sin((φ2 - φ1) / 2) ** 2 +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin((λ2 - λ1) / 2) ** 2
  ));

  if (d < 1e-10) return [[lng1, lat1], [lng2, lat2]];

  const points: [number, number][] = [];
  for (let i = 0; i <= numPoints; i++) {
    const f = i / numPoints;
    const A = Math.sin((1 - f) * d) / Math.sin(d);
    const B = Math.sin(f * d) / Math.sin(d);
    const x = A * Math.cos(φ1) * Math.cos(λ1) + B * Math.cos(φ2) * Math.cos(λ2);
    const y = A * Math.cos(φ1) * Math.sin(λ1) + B * Math.cos(φ2) * Math.sin(λ2);
    const z = A * Math.sin(φ1) + B * Math.sin(φ2);
    const lat = toDeg(Math.atan2(z, Math.sqrt(x * x + y * y)));
    const lng = toDeg(Math.atan2(y, x));
    points.push([lng, lat]);
  }
  return points;
}

/**
 * Estimate departure/arrival times based on position, speed, and distances.
 */
function estimateTimes(
  originLat: number, originLng: number,
  destLat: number, destLng: number,
  currentLat: number, currentLng: number,
  speedKnots: number | null
): { departureTime: string; arrivalTime: string; progress: number } {
  const totalDist = haversineKm(originLat, originLng, destLat, destLng);
  const distFromOrigin = haversineKm(originLat, originLng, currentLat, currentLng);
  const distToDest = haversineKm(currentLat, currentLng, destLat, destLng);

  // Progress along the route (0 to 1)
  const progress = totalDist > 0 ? Math.min(1, Math.max(0, distFromOrigin / totalDist)) : 0;

  // Convert knots to km/h (1 knot = 1.852 km/h)
  const speedKmh = (speedKnots && speedKnots > 50) ? speedKnots * 1.852 : 800; // default cruise ~800 km/h

  const now = Date.now();

  // Estimate how long ago the plane departed (based on distance covered at current speed)
  const hoursFromOrigin = distFromOrigin / speedKmh;
  const departureTime = new Date(now - hoursFromOrigin * 3600 * 1000).toISOString();

  // Estimate when the plane will arrive (based on remaining distance at current speed)
  const hoursToDestination = distToDest / speedKmh;
  const arrivalTime = new Date(now + hoursToDestination * 3600 * 1000).toISOString();

  return { departureTime, arrivalTime, progress };
}

/**
 * Try ADSBDB first (best coverage for scheduled flights).
 */
async function fetchFromAdsbdb(callsign: string): Promise<{ origin: Airport; destination: Airport } | null> {
  try {
    const res = await stealthFetch(
      `https://api.adsbdb.com/v0/callsign/${encodeURIComponent(callsign)}`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const route = data?.response?.flightroute;
    if (!route?.origin || !route?.destination) return null;

    // ADSBDB returns airport objects with icao_code, iata_code, name, etc.
    const originCode = route.origin.icao_code || route.origin.iata_code;
    const destCode = route.destination.icao_code || route.destination.iata_code;

    // Try our embedded database first, fall back to ADSBDB coordinates if available
    let origin = lookupAirport(originCode);
    let destination = lookupAirport(destCode);

    // If not in our DB, construct from ADSBDB response (they include lat/lng sometimes)
    if (!origin && route.origin.latitude && route.origin.longitude) {
      origin = {
        iata: route.origin.iata_code || '',
        icao: route.origin.icao_code || '',
        name: route.origin.name || originCode,
        city: route.origin.municipality || '',
        country: route.origin.country_iso_name || '',
        lat: parseFloat(route.origin.latitude),
        lng: parseFloat(route.origin.longitude),
      };
    }
    if (!destination && route.destination.latitude && route.destination.longitude) {
      destination = {
        iata: route.destination.iata_code || '',
        icao: route.destination.icao_code || '',
        name: route.destination.name || destCode,
        city: route.destination.municipality || '',
        country: route.destination.country_iso_name || '',
        lat: parseFloat(route.destination.latitude),
        lng: parseFloat(route.destination.longitude),
      };
    }

    if (origin && destination) return { origin, destination };
    return null;
  } catch {
    return null;
  }
}

/**
 * Fallback: try HexDB for route resolution.
 */
async function fetchFromHexdb(callsign: string): Promise<{ origin: Airport; destination: Airport } | null> {
  try {
    const res = await stealthFetch(
      `https://hexdb.io/api/v1/route/callsign/${encodeURIComponent(callsign)}`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) return null;
    const data = await res.json();

    // HexDB returns { route: "KJFK-EGLL" } or { origin: "KJFK", destination: "EGLL" }
    let originCode: string | null = null;
    let destCode: string | null = null;

    if (data.route && typeof data.route === 'string' && data.route.includes('-')) {
      const parts = data.route.split('-');
      originCode = parts[0]?.trim();
      destCode = parts[parts.length - 1]?.trim();
    } else if (data.origin && data.destination) {
      originCode = data.origin;
      destCode = data.destination;
    }

    if (!originCode || !destCode) return null;

    const origin = lookupAirport(originCode);
    const destination = lookupAirport(destCode);
    if (origin && destination) return { origin, destination };
    return null;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const callsign = (searchParams.get('callsign') || '').trim().toUpperCase();
  const icao24 = (searchParams.get('icao24') || '').trim().toLowerCase();
  const currentLat = parseFloat(searchParams.get('lat') || '0');
  const currentLng = parseFloat(searchParams.get('lng') || '0');
  const speedKnots = parseFloat(searchParams.get('speed') || '0') || null;

  if (!callsign) {
    return NextResponse.json({ error: 'Missing callsign parameter' }, { status: 400 });
  }

  // Check cache
  const cacheKey = callsign;
  const cached = routeCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < ROUTE_CACHE_TTL) {
    // Recalculate times with current position
    const routeData = { ...cached.data };
    if (currentLat && currentLng && routeData.origin && routeData.destination) {
      const times = estimateTimes(
        routeData.origin.lat, routeData.origin.lng,
        routeData.destination.lat, routeData.destination.lng,
        currentLat, currentLng, speedKnots
      );
      routeData.departureTime = times.departureTime;
      routeData.arrivalTime = times.arrivalTime;
      routeData.progress = times.progress;
    }
    return NextResponse.json(routeData, {
      headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' },
    });
  }

  // Try ADSBDB first, then HexDB fallback
  let route = await fetchFromAdsbdb(callsign);
  let source = 'adsbdb';

  if (!route) {
    route = await fetchFromHexdb(callsign);
    source = 'hexdb';
  }

  if (!route) {
    return NextResponse.json({
      found: false,
      callsign,
      icao24,
      error: 'Route not found — may be a private/military/unscheduled flight',
    }, {
      status: 200, // 200 so frontend can handle gracefully
      headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
    });
  }

  const { origin, destination } = route;

  // Generate great-circle arc points for the route line
  const arcPoints = greatCirclePoints(origin.lat, origin.lng, destination.lat, destination.lng, 72);

  // Estimate times based on current position and speed
  const times = (currentLat && currentLng)
    ? estimateTimes(origin.lat, origin.lng, destination.lat, destination.lng, currentLat, currentLng, speedKnots)
    : { departureTime: null, arrivalTime: null, progress: 0 };

  const totalDistanceKm = Math.round(haversineKm(origin.lat, origin.lng, destination.lat, destination.lng));

  const responseData = {
    found: true,
    callsign,
    icao24,
    source,
    origin: {
      iata: origin.iata,
      icao: origin.icao,
      name: origin.name,
      city: origin.city,
      country: origin.country,
      lat: origin.lat,
      lng: origin.lng,
    },
    destination: {
      iata: destination.iata,
      icao: destination.icao,
      name: destination.name,
      city: destination.city,
      country: destination.country,
      lat: destination.lat,
      lng: destination.lng,
    },
    arc: arcPoints,
    totalDistanceKm,
    departureTime: times.departureTime,
    arrivalTime: times.arrivalTime,
    progress: times.progress,
  };

  // Cache the route data (without dynamic times)
  routeCache.set(cacheKey, {
    data: { ...responseData, departureTime: null, arrivalTime: null, progress: 0 },
    ts: Date.now(),
  });

  // Evict stale entries periodically
  if (routeCache.size > 200) {
    const now = Date.now();
    for (const [key, val] of routeCache) {
      if (now - val.ts > ROUTE_CACHE_TTL * 2) routeCache.delete(key);
    }
  }

  return NextResponse.json(responseData, {
    headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' },
  });
}
