import { NextResponse } from 'next/server';
import { cachedSource } from '@/lib/core/net/source-cache';
import { createPool } from '@/lib/core/net/fetch-pool';
import { httpJson, httpText } from '@/lib/core/net/http-json';
import { BASELINE_WINDOW, parseRadnetCsv, radnetUrl, RADNET_MONITORS, toStation, type RadnetMonitor, type RadnetReading } from './radnet';
import { parseSafecastDevices, SAFECAST_DEVICES_URL } from './safecast';
import type { RadiationStation } from './types';

/**
 * TAKIP — radiation monitors: EPA RadNet fixed stations, rated against each
 * station's own previous week, plus Safecast's real-time sensors (unrated).
 */

const pool = createPool(4);

// RadNet answers 406 to httpText's default `Accept: application/json`.
const CSV = { timeoutMs: 30_000, headers: { Accept: 'text/csv, text/plain, */*' } };

async function loadMonitor(m: RadnetMonitor, now: number): Promise<RadiationStation | null> {
  const year = new Date(now).getUTCFullYear();
  let readings: RadnetReading[] = parseRadnetCsv(await httpText(radnetUrl(m, year), CSV));
  // Early January the new year's file can't fill a week-long baseline on its own.
  if (readings.length <= BASELINE_WINDOW) {
    const last = await httpText(radnetUrl(m, year - 1), CSV).then(parseRadnetCsv, () => []);
    readings = [...last.slice(-BASELINE_WINDOW), ...readings];
  }
  return toStation(m, readings, now);
}

async function collectRadnet(): Promise<RadiationStation[]> {
  const now = Date.now();
  const results = await Promise.allSettled(RADNET_MONITORS.map(m => pool.run(() => loadMonitor(m, now))));
  const stations = results.flatMap(r => (r.status === 'fulfilled' && r.value ? [r.value] : []));
  const failed = results.filter(r => r.status === 'rejected').length;
  if (failed) console.warn(`[TAKIP] RadNet: ${failed}/${RADNET_MONITORS.length} monitors failed`);
  if (!stations.length) throw new Error('RadNet: no monitor answered');
  return stations;
}

async function collectSafecast(): Promise<RadiationStation[]> {
  return parseSafecastDevices(await httpJson<unknown>(SAFECAST_DEVICES_URL, { timeoutMs: 30_000 }), Date.now());
}

const loadRadnet = cachedSource('radiation:radnet', collectRadnet, 60 * 60_000);
const loadSafecast = cachedSource('radiation:safecast', collectSafecast, 15 * 60_000);

export async function GET() {
  const [radnet, safecast] = await Promise.all([loadRadnet(), loadSafecast()]);
  const stations = [...radnet, ...safecast];
  return NextResponse.json({
    stations,
    total: stations.length,
    networks: { 'EPA RadNet': radnet.length, Safecast: safecast.length },
    timestamp: new Date().toISOString(),
  }, {
    headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=900' },
  });
}
