/** aircraft: one aircraft in full: its type and operator, where it is, the leg it is flying and the track behind it. */
import { routeFor } from '@/lib/feeds/aviation/flight-path';
import type { AircraftDetail, Airport, ScheduledRoute } from '@/lib/feeds/aviation/flight-watch';
import { entitiesOf, loaded, type Entity, type FindLayer } from '../catalog';
import { frame } from '../query/geo';
import type { Lookup, Outcome } from '../tools';
import { clip, dataOf, ensure, fail, feedOf, feedTail, getJson, ok, refusedWhy, round, str } from './shared';

const FLIGHT_LAYERS: FindLayer[] = ['flights', 'military_flights'];
const squash = (s: string) => s.toLowerCase().replace(/[\s-]+/g, '');
const airport = (a: Airport | null) => (a ? [a.iata || a.icao, a.city].filter(Boolean).join(' ') : null);

export async function aircraft(a: Record<string, unknown>, lk: Lookup, signal?: AbortSignal): Promise<Outcome> {
  const id = squash(str(a.id ?? a.icao24, 12)), callsign = squash(str(a.callsign, 12)), reg = squash(str(a.registration, 12));
  if (!id && !callsign && !reg) return fail('aircraft', 'Give its icao24 (id from find), callsign or registration');
  if (!FLIGHT_LAYERS.some(l => loaded(dataOf(lk), l))) await ensure(lk, 'flights', signal);
  const all = FLIGHT_LAYERS.flatMap(l => entitiesOf(dataOf(lk), l));
  const live: Entity | undefined = all.find(e => (id && e.id.toLowerCase() === id) || (callsign && squash(str(e.raw.callsign)) === callsign) || (reg && squash(str(e.raw.registration)) === reg));
  const icao = live?.id.toLowerCase() || (/^[0-9a-f]{6}$/.test(id) ? id : '');
  if (!live && !icao) return fail('aircraft', `No aircraft ${callsign || reg || id} is in the air on the map now${feedTail(feedOf(lk, FLIGHT_LAYERS))}`);

  const r = live?.raw ?? {};
  const cs = str(r.callsign).replace(/\s+/g, '') || callsign.toUpperCase();
  const here: [number, number] | null = live?.lat != null && live.lng != null ? [live.lng, live.lat] : null;
  let lookupFailed = '';
  const routeQuery = new URLSearchParams({ callsign: cs, icao24: icao, ...(here ? { lat: String(here[1]), lng: String(here[0]) } : {}), speed: String(r.speed_knots ?? 0) });
  const [detail, schedule] = await Promise.all([
    icao ? getJson<AircraftDetail>(lk, `/api/aircraft?icao24=${encodeURIComponent(icao)}`, signal).catch((err: unknown) => { lookupFailed = refusedWhy(err, 'The aircraft registry'); return undefined; }) : Promise.resolve(null),
    cs ? getJson<ScheduledRoute>(lk, `/api/flight-route?${routeQuery}`, signal).catch(() => null) : Promise.resolve(null),
  ]);
  const leg = routeFor(detail ?? null, schedule ?? null, here ?? detail?.track?.at(-1) ?? [0, 0]);
  const from = airport(leg.origin), to = airport(leg.destination);
  const alt = typeof r.alt === 'number' ? r.alt : null;
  const squawk = str(r.squawk);
  const emergency = /^7[567]00$/.test(squawk) ? { '7500': 'hijack', '7600': 'radio failure', '7700': 'general emergency' }[squawk] : null;
  const model = detail?.model || (str(r.model) !== 'Unknown' ? str(r.model) : '') || null;
  const registration = detail?.registration || (str(r.registration) !== 'N/A' ? str(r.registration) : '') || null;
  const track = detail?.track ?? [];

  const data = {
    icao24: icao || null, callsign: cs || null, registration, type: detail?.typeCode ?? null, model, operator: detail?.operator ?? null,
    ...(here ? { lat: round(here[1]), lng: round(here[0]) } : { in_the_air: false }),
    altitude_m: alt, altitude_ft: alt === null ? null : Math.round(alt / 0.3048),
    speed_kn: typeof r.speed_knots === 'number' ? r.speed_knots : null, heading: typeof r.heading === 'number' ? r.heading : null,
    ...(squawk ? { squawk } : {}), ...(emergency ? { emergency } : {}),
    from, to, route_source: from || to ? (leg.scheduled ? 'schedule, checked against the track' : 'its own track') : null,
    track_points: track.length,
    ...(detail === undefined ? { note: lookupFailed || 'the registry lookup failed' } : detail === null && icao ? { note: 'not in the registry' } : {}),
  };
  const name = cs || registration || icao;
  const summary = [
    `${name}${model ? `, ${model}` : ''}${detail?.operator ? `, ${detail.operator}` : ''}`,
    here ? `${alt !== null ? `${Math.round(alt / 0.3048).toLocaleString('en-US')} ft` : 'altitude unknown'}${data.speed_kn !== null ? `, ${Math.round(data.speed_kn)} kn` : ''}` : 'not on the map now',
    from || to ? `${from ?? '?'} → ${to ?? '?'}` : 'route unknown',
    emergency ? `squawking ${squawk} (${emergency})` : '',
  ].filter(Boolean).join('; ');
  const coords = [...track, ...(here ? [here] : [])];
  const view = frame(coords.map(([lng, lat]) => ({ lat, lng })), 8);
  return ok('aircraft', summary, data, {
    kind: 'aircraft', title: clip(`${name}${model ? ` · ${model}` : ''}`, 60), subtitle: emergency ? `squawk ${squawk}` : detail?.typeCode ?? undefined,
    items: [
      ...(here ? [{ label: 'Now', detail: [alt !== null ? `${Math.round(alt / 0.3048).toLocaleString('en-US')} ft` : '', data.speed_kn !== null ? `${Math.round(data.speed_kn)} kn` : '', data.heading !== null ? `heading ${data.heading}°` : ''].filter(Boolean).join(' · ') || undefined, lat: here[1], lng: here[0] }] : []),
      ...(from || to ? [{ label: `${from ?? '?'} → ${to ?? '?'}`, detail: data.route_source ?? undefined }] : []),
      ...(detail?.operator || registration ? [{ label: detail?.operator ?? 'Operator unknown', detail: [registration, detail?.typeCode].filter(Boolean).join(' · ') || undefined }] : []),
    ],
  }, a.show === false || !coords.length ? undefined : {
    highlight: {
      points: here ? [{ lat: here[1], lng: here[0], label: name }] : [],
      area: null,
      lines: track.length > 1 ? [{ coords: here ? [...track, here] : track, kind: 'track' }] : [],
    },
    ...(view ? { fly: view } : {}),
  });
}
