/** route: a route by road, bike or on foot between two places, drawn on the map. */
import { formatDistance } from '@/lib/core/geodesic';
import { frame } from '../query/geo';
import type { Lookup, Outcome } from '../tools';
import { fail, getJson, ok, placeOf, refusedWhy, str } from './shared';

interface Directions {
  distance: number;
  duration: number;
  geometry?: { coordinates: [number, number][] };
  steps?: { instruction: string; distance: number }[];
  routes?: Directions[];
  error?: string;
}

const MODES: Record<string, 'auto' | 'bicycle' | 'pedestrian'> = { drive: 'auto', car: 'auto', auto: 'auto', bike: 'bicycle', bicycle: 'bicycle', cycle: 'bicycle', walk: 'pedestrian', foot: 'pedestrian', pedestrian: 'pedestrian' };
const WORD = { auto: 'drive', bicycle: 'ride', pedestrian: 'walk' } as const;

export const duration = (s: number) => {
  const m = Math.round(s / 60);
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} min`;
};

export async function route(a: Record<string, unknown>, lk: Lookup, signal?: AbortSignal): Promise<Outcome> {
  const [from, to] = await Promise.all([placeOf(lk, a.from), placeOf(lk, a.to)]);
  if (!from || !to) return fail('route', `Could not find "${str(!from ? a.from : a.to)}" on the map`);
  const mode = MODES[str(a.mode, 12).toLowerCase()] ?? 'auto';
  let res: Directions | null;
  try {
    res = await getJson<Directions>(lk, `/api/v1/directions?from=${from.lat},${from.lng}&to=${to.lat},${to.lng}&mode=${mode}`, signal);
  } catch (err) {
    return fail('route', refusedWhy(err, 'Routing'));
  }
  const best = res?.routes?.[0] ?? res;
  if (!best || !Number.isFinite(best.distance) || best.error) return fail('route', `No ${WORD[mode]}ing route from ${from.name} to ${to.name}${best?.error ? `: ${best.error}` : ''}`);
  const coords = best.geometry?.coordinates ?? [];
  const turns = (best.steps ?? []).filter(s => s.distance > 0 || /arrive/i.test(s.instruction)).slice(0, 12).map(s => `${s.instruction}${s.distance ? ` (${formatDistance(s.distance / 1000)})` : ''}`);
  const dist = formatDistance(best.distance / 1000), time = duration(best.duration);
  const view = frame(coords.length ? coords.map(([lng, lat]) => ({ lat, lng })) : [from, to]);
  return ok('route', `${from.name} to ${to.name}: ${dist}, about ${time} to ${WORD[mode]}`, {
    from: from.name, to: to.name, mode: WORD[mode], distance_km: Math.round(best.distance / 100) / 10, minutes: Math.round(best.duration / 60),
    alternatives: Math.max(0, (res?.routes?.length ?? 1) - 1), turns,
  }, {
    kind: 'route', title: `${from.name} → ${to.name}`, subtitle: `${dist} · ${time}`,
    items: [
      { label: from.name, detail: 'start', lat: from.lat, lng: from.lng },
      ...turns.slice(0, 6).map(t => ({ label: t })),
      { label: to.name, detail: 'end', lat: to.lat, lng: to.lng },
    ],
  }, a.show === false ? undefined : {
    highlight: {
      points: [{ lat: from.lat, lng: from.lng, label: from.name }, { lat: to.lat, lng: to.lng, label: to.name }],
      area: null,
      lines: coords.length > 1 ? [{ coords, label: `${dist} · ${time}`, kind: 'route' }] : [],
    },
    ...(view ? { fly: view } : {}),
  });
}
