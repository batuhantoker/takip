/**
 * International SIGMETs from aviationweather.gov: hazard areas each flight information region issues for
 * thunderstorms, turbulence, icing, volcanic ash and tropical cyclones.
 */

import { createTranslator, msg, type Vars } from '@/lib/core/i18n/translator';

export const ISIGMET_URL = 'https://aviationweather.gov/api/data/isigmet?format=json';

export interface Sigmet {
  id: string;
  fir: string;
  firName: string;
  hazard: string;
  /** Severity words (EMBD, SEV …), a volcano or a cyclone name, as issued. */
  qualifier?: string;
  baseFt?: number;
  topFt?: number;
  /** Valid from and to, ISO. */
  from: string;
  to: string;
  /** "W 15 kt" */
  move?: string;
  change?: string;
  raw: string;
  /** One or more closed rings, unwrapped across the antimeridian. */
  rings: [number, number][][];
}

interface RawPoint { lon: number; lat: number }
interface RawSigmet {
  icaoId?: string; firId?: string; firName?: string; seriesId?: string;
  validTimeFrom?: number; validTimeTo?: number;
  hazard?: string | null; qualifier?: string | null;
  base?: number | null; top?: number | null;
  geom?: string | null; coords?: RawPoint[] | RawPoint[][] | null;
  dir?: string | null; spd?: string | null; chng?: string | null;
  rawSigmet?: string;
}

const HAZARDS: Record<string, string> = {
  TS: msg('Thunderstorms'), TSGR: msg('Thunderstorms with hail'), TURB: msg('Turbulence'), ICE: msg('Icing'), MTW: msg('Mountain waves'),
  VA: msg('Volcanic ash'), TC: msg('Tropical cyclone'), DS: msg('Duststorm'), SS: msg('Sandstorm'), RDOACT: msg('Radioactive cloud'),
};
// The same hazards mid-phrase, after "severe", "embedded"…
const HAZARDS_IN_PHRASE: Record<string, string> = {
  TS: msg('thunderstorms'), TSGR: msg('thunderstorms with hail'), TURB: msg('turbulence'), ICE: msg('icing'), MTW: msg('mountain waves'),
  VA: msg('volcanic ash'), TC: msg('tropical cyclone'), DS: msg('duststorm'), SS: msg('sandstorm'), RDOACT: msg('radioactive cloud'),
};
const WORDS: Record<string, string> = {
  EMBD: msg('embedded'), SEV: msg('severe'), FRQ: msg('frequent'), OCNL: msg('occasional'), OBSC: msg('obscured'), SQL: msg('squall line'), HVY: msg('heavy'), ISOL: msg('isolated'),
};
const CHANGE: Record<string, string> = { NC: msg('No change'), INTSF: msg('Intensifying'), WKN: msg('Weakening') };

type Say = (source: string, vars?: Vars) => string;
const english: Say = createTranslator('en', {});

/** "Severe turbulence", "Volcanic ash · Eruption Mt Semeru", "Tropical cyclone Trudy". */
export function sigmetTitle(hazard: string, qualifier?: string, t: Say = english): string {
  const name = HAZARDS[hazard] ? t(HAZARDS[hazard]) : hazard;
  if (!qualifier) return name;
  const title = (s: string) => s.toLowerCase().replace(/\b\p{L}/gu, ch => ch.toUpperCase());
  if (hazard === 'TC') return `${name} ${title(qualifier)}`;
  if (hazard === 'VA') return `${name} · ${title(qualifier)}`;
  const words = qualifier.split(/\s+/);
  if (words.every(w => WORDS[w] || HAZARDS[w])) {
    const adj = words.filter(w => WORDS[w]).map(w => t(WORDS[w]));
    const nounKey = words.find(w => HAZARDS_IN_PHRASE[w]) ?? hazard;
    const noun = HAZARDS_IN_PHRASE[nounKey] ? t(HAZARDS_IN_PHRASE[nounKey]) : hazard.toLowerCase();
    const text = adj.length ? t('{qualities} {hazard}', { qualities: adj.join(' '), hazard: noun }) : noun;
    return text.charAt(0).toUpperCase() + text.slice(1);
  }
  return `${name} · ${title(qualifier)}`;
}

export const changeText = (chng?: string, t: Say = english) => (chng ? (CHANGE[chng] ? t(CHANGE[chng]) : chng) : undefined);

/** Flight levels from feet: 0 → "SFC", 14000 → "FL140". */
export const flightLevel = (ft: number) => (ft <= 0 ? 'SFC' : `FL${String(Math.round(ft / 100)).padStart(3, '0')}`);

/** A ring that crosses ±180° keeps going past it, so MapLibre draws one shape, not a band around the world. */
export function unwrapRing(ring: [number, number][]): [number, number][] {
  const out: [number, number][] = [];
  for (const [lng, lat] of ring) {
    const prev = out[out.length - 1];
    let x = lng;
    if (prev) while (x - prev[0] > 180) x -= 360;
    if (prev) while (prev[0] - x > 180) x += 360;
    out.push([x, lat]);
  }
  return out;
}

function toRing(points: RawPoint[]): [number, number][] | null {
  const ring = points.filter(p => Number.isFinite(p?.lon) && Number.isFinite(p?.lat)).map(p => [p.lon, p.lat] as [number, number]);
  if (ring.length < 3) return null;
  const [a, z] = [ring[0], ring[ring.length - 1]];
  if (a[0] !== z[0] || a[1] !== z[1]) ring.push([a[0], a[1]]);
  return ring.length >= 4 ? unwrapRing(ring) : null;
}

export function parseIsigmets(json: unknown, now = Date.now()): Sigmet[] {
  if (!Array.isArray(json)) throw new Error('isigmet: expected an array');
  const out: Sigmet[] = [];
  for (const s of json as RawSigmet[]) {
    if (!s?.hazard || !s.coords?.length || !s.validTimeTo || s.validTimeTo * 1000 < now) continue;
    const parts = (Array.isArray(s.coords[0]) ? s.coords : [s.coords]) as RawPoint[][];
    const rings = parts.map(toRing).filter((r): r is [number, number][] => !!r);
    if (!rings.length) continue;
    const fir = s.firId ?? s.icaoId ?? '';
    out.push({
      id: `${fir}:${s.seriesId ?? ''}:${s.validTimeFrom ?? ''}`,
      fir,
      firName: (s.firName ?? fir).replace(new RegExp(`^${fir}\\s+`), ''),
      hazard: s.hazard,
      qualifier: s.qualifier ?? undefined,
      baseFt: s.base ?? undefined,
      topFt: s.top ?? undefined,
      from: new Date((s.validTimeFrom ?? s.validTimeTo) * 1000).toISOString(),
      to: new Date(s.validTimeTo * 1000).toISOString(),
      move: s.dir && s.spd && Number(s.spd) > 0 ? `${s.dir} ${Number(s.spd)} kt` : s.dir === 'STNR' ? 'Stationary' : undefined,
      change: s.chng ?? undefined,
      raw: s.rawSigmet ?? '',
      rings,
    });
  }
  return out;
}
