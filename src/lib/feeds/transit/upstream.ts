import { TAKIP_USER_AGENT } from '../../core/net/user-agent';
import { TIMETABLES } from './generated/schedules.generated';
import { STOP_GRAPHS } from './generated/stop-graphs.generated';
import { parseCta } from './sources/cta';
import { parseFgc } from './sources/fgc';
import { decodeVehiclePositions, type RtFeed, type RtVehicle } from './gtfs/realtime';
import { HAFAS_RADARS, hafasRequest, parseHafasRadar } from './sources/hafas';
import { IETT_BODY, IETT_SOAP_ACTION, parseIett } from './sources/iett';
import { parseLaMetro, readSocket } from './sources/lametro';
import { scheduledVehicles } from './placement/scheduled';
import { parseTfl } from './sources/tfl';
import type { TransitFeed } from './select';
import { placeAtStops, stopFixes } from './placement/stop-place';

/** Hosts that ask callers to name themselves, or that answer a protobuf Accept with base64 text. */
const HOST_HEADERS: Record<string, Record<string, string>> = {
  'api.entur.io': { 'ET-Client-Name': 'takip-personal' },
  'gtfs.adelaidemetro.com.au': { Accept: '*/*' },
};

// The largest feed probed (Entur, all of Norway) is ~1.7 MB.
const MAX_BYTES = 12 * 1024 * 1024;

async function body(res: Response): Promise<Uint8Array> {
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  if (Number(res.headers.get('content-length')) > MAX_BYTES) throw new Error('feed too large');
  const buf = new Uint8Array(await res.arrayBuffer());
  if (buf.length > MAX_BYTES) throw new Error('feed too large');
  return buf;
}

/** One upstream call for a feed's current message, stop-only vehicles still unplaced. Throws on any failure. */
export async function fetchFeed(feed: Pick<TransitFeed, 'id' | 'kind' | 'url'>, signal: AbortSignal): Promise<RtFeed> {
  // Asked for outright: Node's fetch doesn't, and Berlin's 6 MB feed is 1.3 MB gzipped.
  const headers: Record<string, string> = { 'User-Agent': TAKIP_USER_AGENT, 'Accept-Encoding': 'gzip, deflate, br', ...HOST_HEADERS[new URL(feed.url).host] };
  if (feed.kind === 'iett') {
    const res = await fetch(feed.url, {
      method: 'POST', signal, cache: 'no-store',
      headers: { ...headers, 'Content-Type': 'text/xml; charset=utf-8', SOAPAction: IETT_SOAP_ACTION },
      body: IETT_BODY,
    });
    return { vehicles: parseIett(new TextDecoder().decode(await body(res))), atStops: [], trips: new Map() };
  }
  if (feed.kind === 'lametro') return { vehicles: parseLaMetro(await readSocket(feed.url, signal)), atStops: [], trips: new Map() };
  if (feed.kind === 'scheduled') {
    const tt = TIMETABLES[feed.id];
    if (!tt) throw new Error(`no timetable for ${feed.id}`);
    return { vehicles: scheduledVehicles(tt, new Date()), atStops: [], trips: new Map() };
  }
  if (feed.kind === 'hafas') {
    const radar = HAFAS_RADARS[feed.id];
    if (!radar) throw new Error(`no HAFAS radar for ${feed.id}`);
    const { url, body: json } = hafasRequest(radar);
    const res = await fetch(url, { method: 'POST', signal, cache: 'no-store', headers: { ...headers, 'Content-Type': 'application/json' }, body: json });
    return { vehicles: parseHafasRadar(new TextDecoder().decode(await body(res)), radar.lines, Date.now() / 1000), atStops: [], trips: new Map() };
  }
  if (feed.kind === 'tfl') {
    const res = await fetch(feed.url, { signal, cache: 'no-store', headers });
    return { vehicles: [], ...parseTfl(JSON.parse(new TextDecoder().decode(await body(res))), Date.now() / 1000) };
  }
  if (feed.kind === 'fgc') {
    const res = await fetch(feed.url, { signal, cache: 'no-store', headers });
    return { vehicles: parseFgc(new TextDecoder().decode(await body(res)), Date.now() / 1000), atStops: [], trips: new Map() };
  }
  if (feed.kind === 'cta') {
    const res = await fetch(feed.url, { signal, cache: 'no-store', headers });
    return { vehicles: parseCta(new TextDecoder().decode(await body(res))), atStops: [], trips: new Map() };
  }
  const res = await fetch(feed.url, { signal, cache: 'no-store', headers: { Accept: 'application/x-protobuf, application/octet-stream;q=0.9, */*;q=0.1', ...headers } });
  return decodeVehiclePositions(await body(res));
}

/** A feed's current vehicles, stop-only ones (or, with no vehicles at all, its trip updates) placed on its stop graph. Throws on any failure; the caller backs off. */
export async function fetchVehicles(feed: Pick<TransitFeed, 'id' | 'kind' | 'url' | 'graph'>, signal: AbortSignal): Promise<RtVehicle[]> {
  const m = await fetchFeed(feed, signal);
  const graph = feed.graph ? STOP_GRAPHS[feed.graph] : undefined;
  if (!graph) return m.vehicles;
  const now = Date.now() / 1000;
  return [...m.vehicles, ...placeAtStops(stopFixes(m, now), m.trips, graph, now)];
}
