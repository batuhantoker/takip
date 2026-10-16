/** pass: when a satellite next crosses the sky over a place, or what is overhead now, from the loaded element sets. */
import { parseTLE } from '@/lib/feeds/satellites/orbit';
import { compassPoint, lookAngles, nextSkyPasses } from '@/lib/feeds/satellites/pass';
import type { Lookup, Outcome } from '../tools';
import { dataOf, ensure, fail, numIn, ok, placeOf, round, str } from './shared';

interface SatRow { name?: string; noradId?: string; line1?: string; line2?: string; category?: string }

const ISS = '25544';
const MIN_ELEVATION = 10;
const fold = (t: string) => t.toLowerCase().replace(/[\s()-]+/g, '');
const utc = (t: number) => new Date(t).toISOString().slice(0, 16).replace('T', ' ');

export async function pass(a: Record<string, unknown>, lk: Lookup, signal?: AbortSignal): Promise<Outcome> {
  const place = await placeOf(lk, a.near ?? a.place);
  if (!place) return fail('pass', `Could not find "${str(a.near ?? a.place)}" on the map`);
  if (!(await ensure(lk, 'satellites', signal))) return fail('pass', 'The satellite catalogue has not loaded yet; try again in a moment');
  const sats = (Array.isArray(dataOf(lk).satellites) ? dataOf(lk).satellites as SatRow[] : []).filter(s => s.line1 && s.line2);
  if (!sats.length) return fail('pass', 'The satellites are loaded without their orbits, so passes cannot be worked out');
  const now = Date.now();

  if (a.overhead === true) {
    const min = numIn(a.min_elevation, 0, 89) ?? MIN_ELEVATION;
    const up = sats.map(s => {
      const rec = parseTLE(s.line1!, s.line2!);
      const look = rec ? lookAngles(rec, now, place.lat, place.lng) : null;
      return look && look.elevation >= min ? { s, look } : null;
    }).filter(x => x !== null).sort((x, y) => y.look.elevation - x.look.elevation);
    const top = up.slice(0, 15).map(({ s, look }) => ({ id: s.noradId, name: s.name, elevation: Math.round(look.elevation), direction: compassPoint(look.azimuth), category: s.category }));
    return ok('pass', `${up.length} of ${sats.length} tracked satellites are above ${min}° over ${place.name} now${top[0] ? `; highest ${top[0].name} at ${top[0].elevation}°` : ''}`,
      { place: place.name, at: utc(now), count: up.length, of: sats.length, satellites: top },
      { kind: 'pass', title: `Overhead ${place.name}`, subtitle: `${up.length} above ${min}°`, items: top.map(t => ({ label: t.name ?? `NORAD ${t.id}`, detail: `${t.elevation}° ${t.direction}${t.category ? ` · ${t.category}` : ''}` })) });
  }

  const want = str(a.satellite, 60) || ISS;
  const sat = sats.find(s => s.noradId === want.replace(/^0+/, '') || s.noradId === want)
    ?? sats.find(s => fold(s.name ?? '') === fold(want))
    ?? (/^iss$|space station/i.test(want) ? sats.find(s => s.noradId === ISS) : undefined)
    ?? sats.find(s => fold(s.name ?? '').includes(fold(want)));
  if (!sat) return fail('pass', `No satellite "${want}" in the loaded catalogue. Try its NORAD number`);
  const rec = parseTLE(sat.line1!, sat.line2!);
  if (!rec) return fail('pass', `${sat.name}'s orbit can no longer be modelled (it may have re-entered)`);
  const hours = numIn(a.hours, 1, 72) ?? 24;
  let passes = nextSkyPasses(rec, place.lat, place.lng, now, { hours, max: a.visible_only === true ? 30 : 6, minElevation: MIN_ELEVATION });
  if (a.visible_only === true) passes = passes.filter(p => p.visible).slice(0, 6);
  const rows = passes.map(p => ({
    rise_utc: utc(p.rise), peak_utc: utc(p.peak), set_utc: p.set === null ? null : utc(p.set),
    max_elevation: Math.round(p.maxElevation), from: compassPoint(p.riseAzimuth), to: p.setAzimuth === null ? null : compassPoint(p.setAzimuth),
    minutes: p.set === null ? null : Math.round((p.set - p.rise) / 60_000), visible: p.visible,
  }));
  const name = sat.name ?? `NORAD ${sat.noradId}`;
  const first = rows[0];
  return ok('pass',
    first ? `${rows.length} pass${rows.length === 1 ? '' : 'es'} of ${name} over ${place.name} in ${hours} h; next rises ${first.rise_utc} UTC in the ${first.from}, peaks at ${first.max_elevation}°${first.visible ? ', visible by eye' : ', not visible by eye'}` : `${name} does not climb above ${MIN_ELEVATION}° over ${place.name} in the next ${hours} h${a.visible_only === true ? ' where it can be seen' : ''}`,
    { satellite: name, norad: sat.noradId, place: { name: place.name, lat: round(place.lat), lng: round(place.lng) }, min_elevation: MIN_ELEVATION, passes: rows, note: 'times are UTC; visible means sunlit while the sky at the place is dark' },
    { kind: 'pass', title: `${name} over ${place.name}`, subtitle: `next ${hours} h, UTC`,
      items: rows.map(p => ({ label: `${p.rise_utc.slice(5)} → ${p.set_utc?.slice(11) ?? '…'}`, detail: `peak ${p.max_elevation}°, ${p.from} to ${p.to ?? '?'}${p.visible ? ' · visible' : ''}` })) });
}
