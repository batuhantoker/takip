import { pop } from '@/lib/map/popups/kit';
import { TRAFFIC_COLOR } from './map-layers';
import { ODS_CITIES } from './sources/opendatasoft';
import { flowLevel } from './sources/tomtom';
import type { TrafficLevel } from './types';

type Props = Record<string, unknown>;

const num = (v: unknown) => (v == null || v === '' || !Number.isFinite(Number(v)) ? undefined : Number(v));

const SOURCES: Record<string, { label: string; page: string; note: string }> = {
  ndw: {
    label: 'NDW · Netherlands',
    page: 'https://opendata.ndw.nu/',
    note: 'Travel time from floating car data. "Usual" is the time NDW normally expects on this road at this hour.',
  },
  ...Object.fromEntries(ODS_CITIES.map(c => [c.id, {
    label: c.label,
    page: c.page,
    note: `The class is ${c.label}'s own; the tint follows it. It publishes no usual speed.`,
  }])),
};

/** NDW names are words joined by underscores; some are bare site codes, which name nothing. */
export function trafficRoadName(p: Props): string | undefined {
  const raw = typeof p.name === 'string' ? p.name.trim() : '';
  if (!raw || /^[0-9a-z]+$/.test(raw)) return undefined;
  return raw.replace(/_+/g, ' ').replace(/\s+/g, ' ');
}

export function minutesAgo(iso: unknown, now = Date.now()): string | undefined {
  const t = Date.parse(String(iso ?? ''));
  if (!Number.isFinite(t)) return undefined;
  const m = Math.max(0, Math.round((now - t) / 60_000));
  return m < 1 ? 'just now' : `${m} min ago`;
}

/** "34 km/h, 60% of usual" for NDW; "16 km/h · heavy" for a provider that only classes its roads. */
export function trafficReading(p: Props): string {
  const kmh = num(p.kmh), pct = num(p.pctOfUsual);
  const speed = kmh == null ? null : `${kmh} km/h`;
  if (pct != null) return [speed, `${pct}% of usual`].filter(Boolean).join(', ');
  return [speed, typeof p.status === 'string' ? p.status : null].filter(Boolean).join(' · ');
}

export function trafficTip(p: Props, now = Date.now()) {
  const ago = minutesAgo(p.at, now);
  return {
    key: `traffic:${p.id}`,
    name: trafficRoadName(p) ?? 'Road',
    meta: [trafficReading(p), ago && `measured ${ago}`].filter(Boolean).join(' · '),
  };
}

export function trafficPopupHtml(p: Props, now = Date.now()): string {
  const src = SOURCES[String(p.source)] ?? { label: String(p.source ?? ''), page: '', note: '' };
  const kmh = num(p.kmh), pct = num(p.pctOfUsual);
  const at = new Date(String(p.at ?? ''));
  const level = p.level === 'jam' ? 'jam' : 'slow';
  return pop({
    kicker: level === 'jam' ? 'Congested' : 'Slow traffic',
    dot: TRAFFIC_COLOR[level as TrafficLevel],
    meta: minutesAgo(p.at, now) && `measured ${minutesAgo(p.at, now)}`,
    title: trafficRoadName(p) ?? 'Road segment',
    subtitle: src.label,
    rows: [
      { label: 'Speed', value: kmh == null ? undefined : `${kmh} km/h`, mono: true },
      { label: 'Of usual', value: pct == null ? undefined : `${pct}%`, mono: true },
      { label: 'Usual', value: kmh != null && pct ? `${Math.round((kmh * 100) / pct)} km/h` : undefined, mono: true },
      { label: 'Class', value: typeof p.status === 'string' ? p.status : undefined },
      { label: 'Measured', value: Number.isNaN(at.getTime()) ? undefined : `${at.toISOString().slice(11, 16)} UTC`, mono: true },
    ],
    note: src.note,
    links: [!!src.page && { href: src.page, label: src.label.split(' · ')[0] }],
  });
}

const FLOW_NOTE = 'Speed against the free-flow speed TomTom expects on this road, from its probe data. Roads at 65% of free flow or more are not tinted.';

const flowRoad = (p: Props) => (typeof p.road_type === 'string' && p.road_type) || 'Road';

/** "45% of free-flow speed", or "Closed"; TomTom's tiles carry no road name or time. */
export function flowReading(p: Props): string {
  if (p.road_closure === true) return 'Closed';
  const r = num(p.traffic_level);
  return r == null ? '' : `${Math.round(r * 100)}% of free-flow speed`;
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
    kicker: closed ? 'Road closed' : level === 'jam' ? 'Congested' : 'Slow traffic',
    dot: TRAFFIC_COLOR[level],
    title: flowRoad(p),
    subtitle: 'TomTom',
    rows: [
      { label: 'Of free flow', value: closed || r == null ? undefined : `${Math.round(r * 100)}%`, mono: true },
      { label: 'Direction', value: p.traffic_road_coverage === 'one_side' ? 'One side of a two-way road' : p.traffic_road_coverage === 'full' ? 'One-way road' : undefined },
    ],
    note: FLOW_NOTE,
    links: [{ href: 'https://www.tomtom.com/', label: 'TomTom' }],
  });
}
