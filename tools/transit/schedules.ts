// Timetables for metros that publish nothing live, compacted for src/lib/feeds/transit/placement/scheduled.ts: trips with the
// same stops and running times become one pattern with a list of start times per weekday mask.
import { scanCsv, type Zipped } from '../../src/lib/feeds/transit/gtfs/shapes';
import { modeOfRouteType, type TransitMode } from '../../src/lib/feeds/transit/modes';
import type { Timetable } from '../../src/lib/feeds/transit/placement/scheduled';
import { openZip } from '../../src/lib/core/net/remote-zip';

/** A static GTFS as a zip, or as separate CSV files (İBB's, in Windows-1254). */
export type GtfsSource = { zip: string } | { csv: Record<string, string>; encoding?: string };

const RAIL = new Set<TransitMode>(['metro', 'rail', 'tram', 'cable']);
/** Running times this close are one pattern. */
const ROUND_S = 30;

const seconds = (hms: string) => {
  const [h, m, s] = hms.split(':').map(Number);
  return Number.isFinite(h) && Number.isFinite(m) ? h * 3600 + m * 60 + (s || 0) : NaN;
};
const r5 = (v: number) => Math.round(v * 1e5) / 1e5;
const ymd = (d: Date) => Number(d.toISOString().slice(0, 10).replaceAll('-', ''));

async function opener(src: GtfsSource): Promise<(name: string) => Promise<Zipped | null>> {
  if ('zip' in src) {
    const zip = await openZip(src.zip, AbortSignal.timeout(300_000));
    return async name => {
      const f = zip.find(name);
      return f ? { data: await zip.raw(f), method: f.method } : null;
    };
  }
  return async name => {
    const url = src.csv[name];
    if (!url) return null;
    const res = await fetch(url, { signal: AbortSignal.timeout(300_000) });
    if (!res.ok) throw new Error(`${name}: HTTP ${res.status}`);
    // scanCsv reads UTF-8; a stored (method 0) entry is read as is.
    const text = new TextDecoder(src.encoding ?? 'utf-8').decode(await res.arrayBuffer());
    return { data: Buffer.from(text, 'utf8'), method: 0 };
  };
}

/**
 * The rail routes' timetable, or null with none. Services are matched by weekday only: the services in force
 * today, or, when the feed has expired (İBB's ended 2024-12-31), the latest ones it published.
 */
export async function buildTimetable(src: GtfsSource, today = new Date()): Promise<Timetable | null> {
  const file = await opener(src);
  const need = async (name: string) => {
    const f = await file(name);
    if (!f) throw new Error(`no ${name}`);
    return f;
  };

  let tz = '';
  const agency = await file('agency.txt');
  if (agency) await scanCsv(agency, cell => { tz ||= cell('agency_timezone'); });

  const routeIx = new Map<string, number>();
  const routes: Timetable['routes'] = [];
  await scanCsv(await need('routes.txt'), cell => {
    const mode = modeOfRouteType(Number(cell('route_type')));
    if (!mode || !RAIL.has(mode)) return;
    routeIx.set(cell('route_id'), routes.length);
    routes.push({ name: cell('route_short_name') || cell('route_long_name') || cell('route_id'), mode });
  });
  if (!routes.length) return null;

  // Weekday masks, bit 0 Monday, from calendar.txt.
  const services = new Map<string, { mask: number; end: number; current: boolean }>();
  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  const now = ymd(today);
  const calendar = await file('calendar.txt');
  if (calendar) await scanCsv(calendar, cell => {
    const mask = days.reduce((m, d, i) => m | (cell(d) === '1' ? 1 << i : 0), 0);
    const start = Number(cell('start_date')), end = Number(cell('end_date'));
    if (mask) services.set(cell('service_id'), { mask, end, current: start <= now && now <= end });
  });
  // Services that only list dates: the weekdays they run in the fortnight from today, or in the feed's last one.
  const added = new Map<string, Date[]>();
  const dates = await file('calendar_dates.txt');
  if (dates) await scanCsv(dates, cell => {
    const id = cell('service_id'), d = cell('date');
    if (cell('exception_type') !== '1' || services.has(id)) return;
    added.set(id, [...(added.get(id) ?? []), new Date(`${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}T12:00:00Z`)]);
  });
  const all = [...added.values()].flat().map(d => d.getTime());
  if (all.length) {
    const fortnight = 14 * 86_400_000;
    const from = all.some(t => t >= today.getTime() - 86_400_000) ? today.getTime() - 86_400_000 : Math.max(...all) - fortnight;
    for (const [id, ds] of added) {
      const mask = ds.filter(d => d.getTime() >= from && d.getTime() < from + fortnight).reduce((m, d) => m | (1 << ((d.getUTCDay() + 6) % 7)), 0);
      if (mask) services.set(id, { mask, end: now, current: true });
    }
  }

  const tripOf = new Map<string, { route: number; service: string }>();
  await scanCsv(await need('trips.txt'), cell => {
    const route = routeIx.get(cell('route_id'));
    if (route != null && services.has(cell('service_id'))) tripOf.set(cell('trip_id'), { route, service: cell('service_id') });
  });
  // Today's services, else the newest a lapsed feed published.
  const used = [...new Set([...tripOf.values()].map(t => t.service))];
  const current = used.filter(id => services.get(id)!.current);
  const newest = Math.max(...used.map(id => services.get(id)!.end));
  const inForce = new Set(current.length ? current : used.filter(id => services.get(id)!.end === newest));

  const frequencies = new Map<string, [number, number, number][]>();
  const freq = await file('frequencies.txt');
  if (freq) await scanCsv(freq, cell => {
    if (!tripOf.has(cell('trip_id'))) return;
    const row: [number, number, number] = [seconds(cell('start_time')), seconds(cell('end_time')), Number(cell('headway_secs'))];
    if (row.every(Number.isFinite) && row[2] > 0) frequencies.set(cell('trip_id'), [...(frequencies.get(cell('trip_id')) ?? []), row]);
  });

  const stopIx = new Map<string, number>();
  const stopIds: string[] = [];
  const patterns = new Map<string, { route: number; stops: number[]; at: number[]; starts: Map<number, Set<number>> }>();
  let trip = '', rows: { seq: number; stop: string; t: number }[] = [];
  const flush = () => {
    const meta = tripOf.get(trip);
    if (meta && inForce.has(meta.service) && rows.length > 1) {
      rows.sort((a, b) => a.seq - b.seq);
      const t0 = rows[0].t;
      const stops = rows.map(r => {
        if (!stopIx.has(r.stop)) { stopIx.set(r.stop, stopIds.length); stopIds.push(r.stop); }
        return stopIx.get(r.stop)!;
      });
      const at = rows.map(r => Math.round((r.t - t0) / ROUND_S) * ROUND_S);
      const key = `${meta.route}|${stops.join(',')}|${at.join(',')}`;
      let p = patterns.get(key);
      if (!p) patterns.set(key, (p = { route: meta.route, stops, at, starts: new Map() }));
      const mask = services.get(meta.service)!.mask;
      const set = p.starts.get(mask) ?? new Set();
      p.starts.set(mask, set);
      const runs = frequencies.get(trip);
      // A frequency-based trip's own times are only a template for its runs.
      if (runs) for (const [from, to, every] of runs) for (let s = from; s < to; s += every) set.add(s);
      else set.add(t0);
    }
    rows = [];
  };
  await scanCsv(await need('stop_times.txt'), cell => {
    const t = cell('trip_id');
    if (t !== trip) { flush(); trip = t; }
    if (!tripOf.has(t)) return;
    const time = seconds(cell('departure_time') || cell('arrival_time')) || seconds(cell('arrival_time'));
    if (Number.isFinite(time)) rows.push({ seq: Number(cell('stop_sequence')), stop: cell('stop_id'), t: time });
  });
  flush();
  if (!patterns.size) return null;

  const coords = new Map<string, [number, number, string]>();
  await scanCsv(await need('stops.txt'), cell => {
    const id = cell('stop_id'), lat = Number(cell('stop_lat')), lng = Number(cell('stop_lon'));
    if (stopIx.has(id) && Number.isFinite(lat) && Number.isFinite(lng)) coords.set(id, [r5(lng), r5(lat), cell('stop_name')]);
  });
  const missing = stopIds.filter(id => !coords.has(id));
  if (missing.length) throw new Error(`${missing.length} stops without coordinates`);

  // Only the routes that kept a pattern, renumbered.
  const keptRoutes = [...new Set([...patterns.values()].map(p => p.route))].sort((a, b) => a - b);
  const newRoute = new Map(keptRoutes.map((r, i) => [r, i]));
  return {
    tz: tz || 'UTC',
    stops: stopIds.map(id => coords.get(id)!),
    routes: keptRoutes.map(r => routes[r]),
    patterns: [...patterns.values()].map(p => ({
      route: newRoute.get(p.route)!, stops: p.stops, at: p.at,
      starts: Object.fromEntries([...p.starts].map(([mask, s]) => [String(mask), [...s].sort((a, b) => a - b)])),
    })),
  };
}
