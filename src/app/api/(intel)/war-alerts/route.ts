import { NextResponse } from 'next/server';
import { httpJson } from '@/lib/core/net/http-json';
import {
  parseTzevaCities, parseTzevaHistory, parseTzevaNotifications, sirensToAlerts,
  TZEVA_CITIES_URL, TZEVA_HISTORY_URL, TZEVA_NOTIFICATIONS_URL, type TzevaCity,
} from './tzeva-adom';
import { parseUaStates, STALE_AFTER_MS, UA_ALERTS_URL } from './ukraine';
import type { WarAlert, WarAlertSource } from './types';

/**
 * TAKIP — war and air-raid alerts: Israeli sirens by locality (Tzeva Adom)
 * and Ukrainian air-raid state by oblast. A source that fails or is stale is
 * reported in `sources`, never folded into "no alerts".
 */

/**
 * Short-lived memo with in-flight dedup. Not `cachedSource`: that keeps the
 * last non-empty answer, and an emptied siren list must read as all-clear.
 */
function memo<T>(fn: () => Promise<T>, ttlMs: number, keepOnError = false) {
  let value: { v: T; at: number } | null = null;
  let inflight: Promise<T> | null = null;
  return async (): Promise<T> => {
    if (value && Date.now() - value.at < ttlMs) return value.v;
    if (inflight) return inflight;
    inflight = fn()
      .then(v => { value = { v, at: Date.now() }; return v; })
      .catch(e => { if (keepOnError && value) return value.v; throw e; })
      .finally(() => { inflight = null; });
    return inflight;
  };
}

const JSON_OPTS = { timeoutMs: 15_000 };
const loadCities = memo<Map<string, TzevaCity>>(async () => parseTzevaCities(await httpJson(TZEVA_CITIES_URL, { timeoutMs: 30_000 })), 24 * 3_600_000, true);
const loadNow = memo(async () => parseTzevaNotifications(await httpJson(TZEVA_NOTIFICATIONS_URL, JSON_OPTS)), 20_000);
const loadHistory = memo(async () => parseTzevaHistory(await httpJson(TZEVA_HISTORY_URL, JSON_OPTS)), 2 * 60_000);
const loadUkraine = memo(async () => parseUaStates(await httpJson(UA_ALERTS_URL, JSON_OPTS)), 30_000);

async function israel(now: number): Promise<{ alerts: WarAlert[]; source: WarAlertSource }> {
  try {
    const [cities, live, history] = await Promise.all([loadCities(), loadNow(), loadHistory()]);
    const { alerts, unplaced } = sirensToAlerts([...live, ...history], cities, now);
    if (unplaced.length) console.warn(`[TAKIP] Tzeva Adom: ${unplaced.length} places not in cities.json`);
    return { alerts, source: { name: 'Tzeva Adom', ok: true } };
  } catch (e) {
    return { alerts: [], source: { name: 'Tzeva Adom', ok: false, error: e instanceof Error ? e.message : String(e) } };
  }
}

async function ukraine(now: number): Promise<{ alerts: WarAlert[]; source: WarAlertSource }> {
  try {
    const { alerts, at } = await loadUkraine();
    const source: WarAlertSource = { name: 'ubilling.net.ua', ok: true, at: at != null ? new Date(at).toISOString() : undefined };
    if (at == null || now - at > STALE_AFTER_MS) {
      return { alerts: [], source: { ...source, ok: false, error: 'mirror has not refreshed in over 10 minutes' } };
    }
    return { alerts, source };
  } catch (e) {
    return { alerts: [], source: { name: 'ubilling.net.ua', ok: false, error: e instanceof Error ? e.message : String(e) } };
  }
}

export async function GET() {
  const now = Date.now();
  const [il, ua] = await Promise.all([israel(now), ukraine(now)]);
  const alerts = [...il.alerts, ...ua.alerts];
  return NextResponse.json({
    alerts,
    total: alerts.length,
    active: alerts.filter(a => a.active).length,
    sources: [il.source, ua.source],
    timestamp: new Date(now).toISOString(),
  }, {
    headers: { 'Cache-Control': 'public, s-maxage=20, stale-while-revalidate=40' },
  });
}
