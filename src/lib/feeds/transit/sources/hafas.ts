import { createHash } from 'node:crypto';
import type { RtVehicle } from '../gtfs/realtime';
import type { Bbox } from '../view';

/**
 * Metro trains from HAFAS "radar" (JourneyGeoPos), the call operators' journey-planner apps make for their
 * live maps: keyless, lat/lon calculated from the timetable and live delays, so drawn as estimates.
 * Undocumented app endpoints with no licence (configs from public-transport/hafas-client); they can break or
 * block at any time, so each is asked at most every 30 s for one city box.
 */
interface Radar {
  endpoint: string;
  client: Record<string, string>;
  auth: { type: string; aid: string };
  ver: string;
  ext?: string;
  lang?: string;
  /** S-Bahn München signs each body with md5 mic/mac. */
  salt?: string;
  tz: string;
  bbox: Bbox;
  /** The products that run underground; the rest of the city is other feeds' or nobody's. */
  lines: RegExp;
}

export const HAFAS_RADARS: Record<string, Radar> = {
  'hafas-copenhagen': {
    endpoint: 'https://mobilapps.rejseplanen.dk/bin/iphone.exe', client: { type: 'AND', id: 'DK', v: '', name: '' },
    auth: { type: 'AID', aid: 'irkmpm9mdznstenr-android' }, ver: '1.43', ext: 'DK.11', lang: 'da',
    tz: 'Europe/Copenhagen', bbox: [12.45, 55.6, 12.7, 55.74], lines: /^(Metro )?M\d\b/,
  },
  'hafas-vienna': {
    endpoint: 'https://fahrplan.oebb.at/bin/mgate.exe', client: { type: 'IPH', id: 'OEBB', v: '6030600', name: 'oebbIPHONE' },
    auth: { type: 'AID', aid: 'OWDL4fE4ixNiPBBm' }, ver: '1.41', ext: 'OEBB.1',
    tz: 'Europe/Vienna', bbox: [16.25, 48.13, 16.52, 48.3], lines: /^U\d\b/,
  },
  'hafas-munich': {
    endpoint: 'https://s-bahn-muenchen.hafas.de/bin/540/mgate.exe', client: { type: 'IPH', id: 'DB-REGIO-MVV', v: '5010100', name: 'MuenchenNavigator' },
    auth: { type: 'AID', aid: 'd491MVVhz9ZZts23' }, ver: '1.34', ext: 'DB.R15.12.a', salt: 'ggnvMVV8RTt67gh1',
    tz: 'Europe/Berlin', bbox: [11.4, 48.05, 11.75, 48.25], lines: /^U\d\b/,
  },
  'hafas-hamburg': {
    endpoint: 'https://nahsh.hafas.cloud/gate', client: { type: 'IPH', id: 'NAHSH', v: '3000700', name: 'NAHSHPROD' },
    auth: { type: 'AID', aid: 'r0Ot9FLFNAFxijLW' }, ver: '1.30',
    tz: 'Europe/Berlin', bbox: [9.8, 53.45, 10.3, 53.72], lines: /^U\d\b/,
  },
  'hafas-frankfurt': {
    endpoint: 'https://www.rmv.de/auskunft/bin/jp/mgate.exe', client: { type: 'WEB', id: 'RMV', name: 'webapp' },
    auth: { type: 'AID', aid: 'x0k4ZR33ICN9CWmj' }, ver: '1.44', ext: 'RMV.1',
    tz: 'Europe/Berlin', bbox: [8.5, 50.03, 8.8, 50.23], lines: /^U\d\b/,
  },
};

/** "20261016", "001500" on the radar's own wall clock. */
function localStamp(tz: string, at: Date) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(at).map(x => [x.type, x.value]));
  return { date: `${p.year}${p.month}${p.day}`, time: `${p.hour}${p.minute}${p.second}` };
}

export function hafasRequest(r: Radar, at = new Date()): { url: string; body: string } {
  const [w, s, e, n] = r.bbox;
  const body = JSON.stringify({
    lang: r.lang ?? 'de',
    svcReqL: [{
      meth: 'JourneyGeoPos', cfg: { polyEnc: 'GPA' },
      req: {
        maxJny: 800, onlyRT: false, ...localStamp(r.tz, at),
        rect: { llCrd: { x: Math.round(w * 1e6), y: Math.round(s * 1e6) }, urCrd: { x: Math.round(e * 1e6), y: Math.round(n * 1e6) } },
        perSize: 30_000, perStep: 30_000, ageOfReport: true, trainPosMode: 'CALC',
      },
    }],
    client: r.client, ver: r.ver, auth: r.auth, ...(r.ext ? { ext: r.ext } : {}),
  });
  if (!r.salt) return { url: r.endpoint, body };
  const mic = createHash('md5').update(body).digest('hex');
  const mac = createHash('md5').update(mic + r.salt).digest('hex');
  return { url: `${r.endpoint}?mic=${mic}&mac=${mac}`, body };
}

interface Reply {
  svcResL?: { err?: string; res?: { common?: { prodL?: { name?: string }[] }; jnyL?: { jid?: string; pos?: { x: number; y: number }; prodX?: number; dirTxt?: string }[] } }[];
  err?: string;
}

/** Throws on an error reply, so the feed backs off. */
export function parseHafasRadar(text: string, lines: RegExp, nowS: number): RtVehicle[] {
  const reply = JSON.parse(text) as Reply;
  const r = reply.svcResL?.[0];
  if (!r || (r.err && r.err !== 'OK')) throw new Error(`HAFAS: ${r?.err ?? reply.err ?? 'no reply'}`);
  const prods = r.res?.common?.prodL ?? [];
  const out: RtVehicle[] = [];
  for (const j of r.res?.jnyL ?? []) {
    const name = j.prodX != null ? prods[j.prodX]?.name?.trim() : undefined;
    if (!j.jid || !j.pos || !name || !lines.test(name)) continue;
    out.push({
      id: j.jid, lat: j.pos.y / 1e6, lng: j.pos.x / 1e6, route: name.replace(/^Metro /, ''), mode: 'metro', estimated: true, t: Math.round(nowS),
    });
  }
  return out;
}
