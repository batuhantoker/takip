import { readableRoute } from '@/lib/feeds/transit/describe';
import type { TransitResponse } from '@/lib/feeds/transit/view';
import { ownApi } from '../../live/own-api';
import type { Place } from '../place';
import { placeBox } from '../paths';

/** What the transit layer has around a place right now. */
export interface TransitNow {
  total: number;
  /** The square it counted, `km` each way from the centre. */
  km: number;
  /** Feeds with vehicles, most first. */
  feeds: { name: string; count: number }[];
  /** Placed from arrival predictions, and run from the timetable. */
  estimated: number;
  scheduled: number;
  /** Routes with the most vehicles on them, as riders know them. */
  busiest: { route: string; count: number }[];
  /** Feeds that failed with nothing cached. */
  down: string[];
  at: number;
}

export function summarise(json: TransitResponse, km: number, at: number): TransitNow | null {
  if (json.tooWide) return null;
  const routes = new Map<string, number>();
  let estimated = 0, scheduled = 0;
  for (const v of json.vehicles) {
    if (v.scheduled) scheduled++;
    else if (v.estimated) estimated++;
    const route = readableRoute(v.route);
    if (route) routes.set(route, (routes.get(route) ?? 0) + 1);
  }
  return {
    total: json.vehicles.length,
    km,
    feeds: json.feeds.filter(f => f.count > 0).map(f => ({ name: f.name, count: f.count })).sort((a, b) => b.count - a.count),
    estimated,
    scheduled,
    busiest: [...routes].map(([route, count]) => ({ route, count })).filter(r => r.count >= 2).sort((a, b) => b.count - a.count).slice(0, 5),
    down: json.feeds.filter(f => !f.ok).map(f => f.name),
    at,
  };
}

/** The vehicles within `km` of the place; null when the route failed, or found nothing because a feed did. */
export async function transitNow(place: Place, km: number): Promise<TransitNow | null> {
  const json = await ownApi<TransitResponse>(`/api/transit?bbox=${placeBox(place, km).join(',')}`, 60);
  const now = json && summarise(json, km, Date.parse(json.timestamp) || Date.now());
  return now && (now.total > 0 || !now.down.length) ? now : null;
}
