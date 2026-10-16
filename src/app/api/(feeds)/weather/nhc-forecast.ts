import { httpJson } from '@/lib/core/net/http-json';
import { NHC_URL, type NhcStorm } from './nhc';

/*
 * The NHC forecast for each active storm: the cone of uncertainty, the forecast track and the forecast
 * points, from NOAA's tropical MapServer (layers 7, 6 and 5). The MapServer can lag or lead
 * CurrentStorms.json by an advisory, so only geometry from each storm's current advisory is kept.
 * US public domain.
 */

const MAPSERVER = 'https://mapservices.weather.noaa.gov/tropical/rest/services/tropical/NHC_tropical_weather_summary/MapServer';
const LAYERS = { points: 5, track: 6, cone: 7 } as const;

export function nhcLayerUrl(layer: number): string {
  const q = new URLSearchParams({ where: '1=1', outFields: '*', returnGeometry: 'true', geometryPrecision: '3', outSR: '4326', f: 'geojson' });
  return `${MAPSERVER}/${layer}/query?${q}`;
}

/** Each active storm's current forecast advisory number, by NHC bin (EP1, AL3, …). */
export function currentAdvisories(json: unknown): Map<string, number> {
  const storms = (json as { activeStorms?: NhcStorm[] } | null)?.activeStorms ?? [];
  const out = new Map<string, number>();
  for (const s of storms as (NhcStorm & { forecastAdvisory?: { advNum?: string } | null })[]) {
    const adv = parseInt(s.forecastAdvisory?.advNum ?? '', 10);
    if (s.binNumber && Number.isFinite(adv)) out.set(s.binNumber.toUpperCase(), adv);
  }
  return out;
}

export type ForecastKind = 'cone' | 'track' | 'point';
type Raw = GeoJSON.Feature<GeoJSON.Geometry | null, Record<string, unknown>>;

/** NHC writes 9999 for a value it doesn't forecast. */
const value = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v !== 9999 ? v : null);
const text = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);

/** Development stage of a forecast point, from its `dvlbl` letter. */
const STAGES: Record<string, string> = {
  D: 'Tropical depression', S: 'Tropical storm', H: 'Hurricane', M: 'Major hurricane',
  L: 'Post-tropical low', X: 'Post-tropical', R: 'Remnant low',
};

export function shapeForecast(kind: ForecastKind, features: Raw[], advisories: Map<string, number>): GeoJSON.Feature[] {
  return features.flatMap(f => {
    const p = f.properties ?? {};
    const bin = text(p.binnumber)?.toUpperCase();
    const advisory = parseInt(String(p.advisnum ?? ''), 10);
    if (!f.geometry || !bin || advisories.get(bin) !== advisory) return [];
    const name = text(p.stormname)?.replace(/^(Tropical Storm|Tropical Depression|Hurricane|Major Hurricane|Post-Tropical Cyclone|Remnants of)\s+/i, '') ?? bin;
    const base = { kind, storm: name, bin, advisory, stormType: text(p.stormtype) };
    if (kind !== 'point') return [{ type: 'Feature', geometry: f.geometry, properties: base }];
    const stage = text(p.dvlbl)?.toUpperCase() ?? '';
    return [{
      type: 'Feature',
      geometry: f.geometry,
      properties: {
        ...base,
        stage,
        stageLabel: STAGES[stage] ?? text(p.tcdvlp) ?? 'Forecast',
        hours: value(p.tau),
        /** Valid time in the advisory's own zone, as NHC writes it: `2026-10-16 5:00 AM Fri MST`. */
        when: text(p.fldatelbl),
        wind: value(p.maxwind),
        gust: value(p.gust),
        pressure: value(p.mslp),
      },
    }];
  });
}

const TTL_MS = 5 * 60_000;
let held: { at: number; features: GeoJSON.Feature[] } | null = null;
let inflight: Promise<GeoJSON.Feature[]> | null = null;

/** Cones, then tracks, then points, so later ones draw on top in one source; the last good copy on failure. */
export function loadNhcForecast(): Promise<GeoJSON.Feature[]> {
  if (held && Date.now() - held.at < TTL_MS) return Promise.resolve(held.features);
  inflight ??= (async () => {
    try {
      const advisories = currentAdvisories(await httpJson<unknown>(NHC_URL, { timeoutMs: 20_000 }));
      const features: GeoJSON.Feature[] = [];
      if (advisories.size) {
        const [cone, track, points] = await Promise.all([LAYERS.cone, LAYERS.track, LAYERS.points]
          .map(l => httpJson<{ features?: Raw[] }>(nhcLayerUrl(l), { timeoutMs: 30_000 })));
        features.push(...shapeForecast('cone', cone.features ?? [], advisories), ...shapeForecast('track', track.features ?? [], advisories),
          ...shapeForecast('point', points.features ?? [], advisories));
      }
      held = { at: Date.now(), features };
    } catch (e) {
      console.warn('[TAKIP] NHC forecast failed:', e instanceof Error ? e.message : e);
    } finally {
      inflight = null;
    }
    return held?.features ?? [];
  })();
  return inflight;
}
