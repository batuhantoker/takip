import { NextResponse } from 'next/server';
import { centroidFor } from '@/lib/places/country-centroids';
import { cachedSource } from '@/lib/core/net/source-cache';
import { mapAnnotations, mapAnomalies, type RawAnnotation, type RawAnomaly } from '@/lib/intel/outages/cloudflare';
import type { Outage } from '@/lib/intel/outages/outage';

export const dynamic = 'force-dynamic';

/**
 * TAKIP — Cloudflare Radar (internet disruption + attack origin)
 * Source: https://radar.cloudflare.com/  (API docs: developers.cloudflare.com/radar)
 *
 * Requires CLOUDFLARE_API_TOKEN — a free Cloudflare account token scoped to
 * "Radar: Read". Fails closed: with no token the route reports itself
 * unconfigured and the map layer stays hidden.
 *
 * The token is read server-side only and is never included in a response.
 */

const RADAR_BASE = 'https://api.cloudflare.com/client/v4/radar';

interface RadarAttackOrigin {
  country: string;
  country_name: string;
  lat: number;
  lng: number;
  /** Share of observed layer-3 attack traffic, as a percentage. */
  share: number;
}

/* Fields are optional because Cloudflare adds and reorders them between API versions. */
interface RawTopLocation {
  originCountryAlpha2?: string;
  clientCountryAlpha2?: string;
  originCountry?: string;
  originCountryName?: string;
  clientCountryName?: string;
  value?: string | number;
}

interface RadarResult {
  annotations?: RawAnnotation[];
  trafficAnomalies?: RawAnomaly[];
  top_0?: RawTopLocation[];
  top0?: RawTopLocation[];
}

function isConfigured() {
  return Boolean(process.env.CLOUDFLARE_API_TOKEN);
}

async function radarFetch(path: string, signal: AbortSignal): Promise<RadarResult> {
  const res = await fetch(`${RADAR_BASE}${path}`, {
    signal,
    cache: 'no-store',
    headers: {
      Authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`,
      Accept: 'application/json',
    },
  });
  if (!res.ok) throw new Error(`Radar ${path} responded ${res.status}`);
  const json = await res.json();
  // Cloudflare wraps everything in { success, errors, result }.
  if (json?.success === false) {
    const detail = json?.errors?.[0]?.message || 'unknown error';
    throw new Error(`Radar ${path} rejected the request: ${detail}`);
  }
  return json?.result ?? {};
}

function mapAttackOrigins(result: RadarResult): RadarAttackOrigin[] {
  // Top-N endpoints return the series under `top_0`.
  const rows = result?.top_0 ?? result?.top0 ?? [];
  const out: RadarAttackOrigin[] = [];

  for (const r of rows) {
    const code = r?.originCountryAlpha2 ?? r?.clientCountryAlpha2 ?? r?.originCountry;
    const c = centroidFor(code);
    if (!c) continue;
    out.push({
      country: String(code).toUpperCase(),
      country_name: r?.originCountryName ?? r?.clientCountryName ?? String(code),
      lng: c[0],
      lat: c[1],
      share: Number(Number(r?.value).toFixed(2)) || 0,
    });
  }
  return out;
}

interface RadarPayload { outages: Outage[]; attack_origins: RadarAttackOrigin[]; errors: string[] }

// Every open map polls this route; one round of upstream calls per 5 minutes serves them all.
const load = cachedSource<RadarPayload>('cloudflare-radar', async () => {
  const signal = AbortSignal.timeout(20000);

  // Degrade per-section rather than all-or-nothing: one endpoint failing should
  // not blank the whole layer.
  const [outagesRes, anomaliesRes, attacksRes] = await Promise.allSettled([
    radarFetch('/annotations/outages?limit=50&format=json', signal),
    radarFetch('/traffic_anomalies?limit=60&dateRange=7d&format=json', signal),
    // Radar rejects this endpoint with a 400 unless it is given a window.
    radarFetch('/attacks/layer3/top/locations/origin?limit=25&dateRange=1d&format=json', signal),
  ]);

  const annotated = outagesRes.status === 'fulfilled' ? mapAnnotations(outagesRes.value.annotations ?? []) : [];
  const anomalies = anomaliesRes.status === 'fulfilled' ? mapAnomalies(anomaliesRes.value.trafficAnomalies ?? [], annotated) : [];
  const outages = [...annotated, ...anomalies];
  const attack_origins = attacksRes.status === 'fulfilled' ? mapAttackOrigins(attacksRes.value) : [];

  const errors: string[] = [];
  if (outagesRes.status === 'rejected') errors.push(`outages: ${outagesRes.reason?.message ?? 'failed'}`);
  if (anomaliesRes.status === 'rejected') errors.push(`anomalies: ${anomaliesRes.reason?.message ?? 'failed'}`);
  if (attacksRes.status === 'rejected') errors.push(`attack_origins: ${attacksRes.reason?.message ?? 'failed'}`);

  if (outages.length === 0 && attack_origins.length === 0 && errors.length > 0) throw new Error(errors.join('; '));
  return [{ outages, attack_origins, errors }];
}, 5 * 60_000);

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  // Capability probe — lets the UI decide whether to show the layer without
  // provoking an upstream call. Always 200 so it is cheap and unambiguous.
  if (searchParams.get('probe') === '1') {
    return NextResponse.json({ configured: isConfigured(), source: 'Cloudflare Radar' });
  }

  if (!isConfigured()) {
    return NextResponse.json(
      {
        configured: false,
        outages: [],
        attack_origins: [],
        error: 'Cloudflare Radar not configured',
        hint: 'Set CLOUDFLARE_API_TOKEN (Cloudflare account → API Tokens → Radar: Read) in .env',
      },
      { status: 503 }
    );
  }

  const [payload] = await load();
  if (!payload) {
    return NextResponse.json(
      { configured: true, outages: [], attack_origins: [], error: 'Cloudflare Radar unavailable' },
      { status: 502 }
    );
  }
  const { outages, attack_origins, errors } = payload;

  return NextResponse.json(
    {
      configured: true,
      outages,
      attack_origins,
      total_outages: outages.length,
      total_attack_origins: attack_origins.length,
      ...(errors.length > 0 ? { partial: true, errors } : {}),
      source: 'Cloudflare Radar',
      timestamp: new Date().toISOString(),
    },
    { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' } }
  );
}
