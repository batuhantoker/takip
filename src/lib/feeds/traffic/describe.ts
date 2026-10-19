import { t } from '@/lib/core/i18n/active';
import { msg } from '@/lib/core/i18n/translator';
import { pop } from '@/lib/map/popups/kit';
import { TRAFFIC_COLOR } from './map-layers';
import { ODS_CITIES } from './sources/opendatasoft';
import { flowLevel } from './sources/tomtom';
import type { TrafficLevel } from './types';

type Props = Record<string, unknown>;

const num = (v: unknown) => (v == null || v === '' || !Number.isFinite(Number(v)) ? undefined : Number(v));

const SOURCES: Record<string, { label: string; page: string; note: () => string }> = {
  ndw: {
    label: 'NDW · Netherlands',
    page: 'https://opendata.ndw.nu/',
    note: () => t('Travel time from floating car data. "Usual" is the time NDW normally expects on this road at this hour.'),
  },
  ...Object.fromEntries(ODS_CITIES.map(c => [c.id, {
    label: c.label,
    page: c.page,
    note: () => t("The class is {city}'s own; the tint follows it. It publishes no usual speed.", { city: c.label }),
  }])),
};

/** NDW names are words joined by underscores; some are bare site codes, which name nothing. */
export function trafficRoadName(p: Props): string | undefined {
  const raw = typeof p.name === 'string' ? p.name.trim() : '';
  if (!raw || /^[0-9a-z]+$/.test(raw)) return undefined;
  return raw.replace(/_+/g, ' ').replace(/\s+/g, ' ');
}

export function minutesAgo(iso: unknown, now = Date.now()): string | undefined {
  const ms = Date.parse(String(iso ?? ''));
  if (!Number.isFinite(ms)) return undefined;
  const m = Math.max(0, Math.round((now - ms) / 60_000));
  return m < 1 ? t('just now') : t('{n} min ago', { n: m });
}

/** "34 km/h, 60% of usual" for NDW; "16 km/h · heavy" for a provider that only classes its roads. */
export function trafficReading(p: Props): string {
  const kmh = num(p.kmh), pct = num(p.pctOfUsual);
  const speed = kmh == null ? null : `${kmh} km/h`;
  if (pct != null) return [speed, t('{pct}% of usual', { pct })].filter(Boolean).join(', ');
  return [speed, typeof p.status === 'string' ? p.status : null].filter(Boolean).join(' · ');
}

export function trafficTip(p: Props, now = Date.now()) {
  const ago = minutesAgo(p.at, now);
  return {
    key: `traffic:${p.id}`,
    name: trafficRoadName(p) ?? t('Road'),
    meta: [trafficReading(p), ago && t('measured {ago}', { ago })].filter(Boolean).join(' · '),
  };
}

export function trafficPopupHtml(p: Props, now = Date.now()): string {
  const src = SOURCES[String(p.source)] ?? { label: String(p.source ?? ''), page: '', note: () => '' };
  const kmh = num(p.kmh), pct = num(p.pctOfUsual);
  const at = new Date(String(p.at ?? ''));
  const level = p.level === 'jam' ? 'jam' : 'slow';
  const ago = minutesAgo(p.at, now);
  return pop({
    kicker: level === 'jam' ? t('Congested') : t('Slow traffic'),
    dot: TRAFFIC_COLOR[level as TrafficLevel],
    meta: ago && t('measured {ago}', { ago }),
    title: trafficRoadName(p) ?? t('Road segment'),
    subtitle: src.label,
    rows: [
      { label: t('Speed'), value: kmh == null ? undefined : `${kmh} km/h`, mono: true },
      { label: t('Of usual'), value: pct == null ? undefined : `${pct}%`, mono: true },
      { label: t('Usual'), value: kmh != null && pct ? `${Math.round((kmh * 100) / pct)} km/h` : undefined, mono: true },
      { label: t('Class'), value: typeof p.status === 'string' ? p.status : undefined },
      { label: t('Measured'), value: Number.isNaN(at.getTime()) ? undefined : `${at.toISOString().slice(11, 16)} UTC`, mono: true },
    ],
    note: src.note(),
    links: [!!src.page && { href: src.page, label: src.label.split(' · ')[0] }],
  });
}

const FLOW_NOTE = msg('Speed against the free-flow speed TomTom expects on this road, from its probe data. Roads at 65% of free flow or more are not tinted.');

const flowRoad = (p: Props) => (typeof p.road_type === 'string' && p.road_type) || t('Road');

/** "45% of free-flow speed", or "Closed"; TomTom's tiles carry no road name or time. */
export function flowReading(p: Props): string {
  if (p.road_closure === true) return t('Closed');
  const r = num(p.traffic_level);
  return r == null ? '' : t('{pct}% of free-flow speed', { pct: Math.round(r * 100) });
}

export function flowTip(p: Props) {
  return {
    key: `traffic-flow:${p.road_type}:${p.traffic_level}:${p.road_closure}`,
    name: flowRoad(p),
    meta: [flowReading(p), 'TomTom'].filter(Boolean).join(' · '),
  };
}

export function flowPopupHtml(p: Props): string {
  const closed = p.road_closure === true;
  const level = flowLevel(p) ?? 'slow';
  const r = num(p.traffic_level);
  return pop({
    kicker: closed ? t('Road closed') : level === 'jam' ? t('Congested') : t('Slow traffic'),
    dot: TRAFFIC_COLOR[level],
    title: flowRoad(p),
    subtitle: 'TomTom',
    rows: [
      { label: t('Of free flow'), value: closed || r == null ? undefined : `${Math.round(r * 100)}%`, mono: true },
      { label: t('Direction'), value: p.traffic_road_coverage === 'one_side' ? t('One side of a two-way road') : p.traffic_road_coverage === 'full' ? t('One-way road') : undefined },
    ],
    note: t(FLOW_NOTE),
    links: [{ href: 'https://www.tomtom.com/', label: 'TomTom' }],
  });
}
