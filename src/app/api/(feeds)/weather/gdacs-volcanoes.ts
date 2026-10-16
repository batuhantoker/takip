/**
 * TAKIP — current GDACS volcano alerts from its JSON API (the RSS carries no VO items), no key.
 * EC JRC / UN; credit GDACS. One event type per request: a missing type or a list answers 400.
 * The alert level is a modelled impact estimate, often revised; green is not "no harm".
 */

export const GDACS_VO_URL = 'https://www.gdacs.org/gdacsapi/api/events/geteventlist/MAP?eventtype=VO';

export interface GdacsFeature {
  geometry?: { type?: string; coordinates?: number[] } | null;
  properties?: {
    eventtype?: string;
    eventid?: number;
    episodeid?: number;
    eventname?: string;
    htmldescription?: string;
    alertlevel?: string;
    iscurrent?: string;
    country?: string;
    fromdate?: string;
    url?: { report?: string } | null;
  } | null;
}

export interface VolcanoEvent {
  id: string;
  title: string;
  category: 'volcanoes';
  type: 'Volcano Eruption';
  icon: 'volcano';
  severity: 'low' | 'medium' | 'high';
  lat: number;
  lng: number;
  date?: string;
  area?: string;
  source: string;
  provider: 'GDACS';
}

const SEVERITY: Record<string, VolcanoEvent['severity']> = { red: 'high', orange: 'medium' };

export function mapGdacsVolcano(f: GdacsFeature | null | undefined): VolcanoEvent | null {
  const p = f?.properties;
  const [lng, lat] = f?.geometry?.type === 'Point' ? f.geometry.coordinates ?? [] : [];
  if (!p || p.eventtype !== 'VO' || p.iscurrent !== 'true' || p.eventid == null) return null;
  if (typeof lat !== 'number' || typeof lng !== 'number' || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  const level = (p.alertlevel ?? '').trim();
  return {
    id: `gdacs-VO-${p.eventid}-${p.episodeid ?? 1}`,
    title: p.htmldescription?.trim() || `${level} eruption ${p.eventname ?? ''}`.trim(),
    category: 'volcanoes',
    type: 'Volcano Eruption',
    icon: 'volcano',
    severity: SEVERITY[level.toLowerCase()] ?? 'low',
    lat,
    lng,
    date: p.fromdate ? `${p.fromdate}Z` : undefined,
    area: p.country || undefined,
    source: p.url?.report || 'https://www.gdacs.org/',
    provider: 'GDACS',
  };
}

/** One event per eventid + episode: GDACS can list the same eruption twice. */
export function parseGdacsVolcanoes(json: unknown): VolcanoEvent[] {
  const features = (json as { features?: unknown } | null)?.features;
  if (!Array.isArray(features)) throw new Error('GDACS VO: unexpected response');
  const out = new Map<string, VolcanoEvent>();
  for (const f of features) {
    const e = mapGdacsVolcano(f as GdacsFeature);
    if (e && !out.has(e.id)) out.set(e.id, e);
  }
  return [...out.values()];
}
