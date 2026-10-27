import { leadSentences } from '@/lib/core/wikipedia/summary';
import type { Translate } from '@/lib/core/i18n/translator';
import { AU_KM } from '@/lib/space/astro';
import { compact, lightTime } from '@/lib/space/format';
import { msFromJd } from '@/lib/space/horizons';
import { SKY_BODIES, type SkyKey } from '@/lib/space/sky';
import type { CraftPage } from './craft-page';
import type { FlightStep } from './flights';
import type { PlanetPage } from './planet-page';
import { KIND_LABEL } from './roster';

/**
 * TAKIP — the words of the space pages: titles in the words people search ("where is Voyager 1 now"), descriptions
 * that lead with what the craft is, and the flight's steps as sentences.
 */

const TITLE_MAX = 60;
const CJK = new Set(['zh', 'ja']);

/** How long a title and a description may run in the reader's script. */
export const titleMax = (t: Translate) => (CJK.has(t.locale) ? 32 : TITLE_MAX);
export const descriptionMax = (t: Translate) => (CJK.has(t.locale) ? 90 : 160);

/** "Apollo 11 · Tranquility Base" is "Apollo 11" in a title. */
export const shortName = (name: string) => name.split(' · ')[0];

export const bodyName = (t: Translate, key: SkyKey) => t(SKY_BODIES.find(b => b.key === key)?.name ?? key);

/** A moment from a flight, as a date in the reader's language. Dates before 1970 are fine: Date takes negative ms. */
export const flightDate = (t: Translate, jd: number) =>
  new Intl.DateTimeFormat(t.intl, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(msFromJd(jd));

export const launchDate = (t: Translate, utc: string) =>
  new Intl.DateTimeFormat(t.intl, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(Date.parse(utc));

/** "254 million km": a distance in the planet's own scale. */
export const bigKm = (t: Translate, km: number) => t('{amount} km', { amount: km >= 1e6 ? compact(km, t.intl) : Math.round(km).toLocaleString(t.intl) });

/** "223 million km", with astronomical units beside it once it is past one. */
export function distanceText(t: Translate, km: number): string {
  const au = km / AU_KM;
  return au >= 1 ? `${bigKm(t, km)} (${au.toLocaleString(t.intl, { maximumFractionDigits: au < 10 ? 2 : 1 })} AU)` : bigKm(t, km);
}

export function fit(candidates: string[], max: number): string {
  return candidates.find(c => [...c].length <= max) ?? candidates[candidates.length - 1];
}

export function craftTitle(t: Translate, p: CraftPage): string {
  const name = shortName(p.craft.name);
  const max = CJK.has(t.locale) ? 32 : TITLE_MAX;
  if (p.craft.rover) return fit([t('Where is the {name} rover now? Live map of Mars', { name }), t('{name} rover: where it is on Mars now', { name })], max);
  if (p.site) {
    const onMars = p.craft.site?.world === 'mars';
    if (p.craft.kind === 'rover') return fit([onMars ? t('{name} rover: where it landed on Mars', { name }) : t('{name} rover: where it landed on the Moon', { name }), name], max);
    return fit([onMars ? t('{name} landing site on Mars', { name }) : t('{name} landing site on the Moon', { name }), name], max);
  }
  if (p.craft.gone) return fit([t('{name}: the mission and its flight', { name }), name], max);
  if (p.craft.horizons !== undefined && p.craft.kind !== 'station') {
    return fit([t('Where is {name} now? Live distance from Earth', { name }), t('{name}: where it is now', { name }), name], max);
  }
  return fit([t('{name}: where it is now', { name }), name], max);
}

/** The craft's note leads; the tail says what else the page holds. */
export function craftDescription(t: Translate, p: CraftPage, wikiLead: string | null): string {
  const max = CJK.has(t.locale) ? 90 : 160;
  const tail = p.craft.rover
    ? t('Its place on Mars, sol and distance driven from NASA, with its landing site in 3D.')
    : p.site
      ? p.craft.site?.world === 'mars' ? t('Where it landed, on a 3D globe of Mars.') : t('Where it landed, on a 3D globe of the Moon.')
      : p.craft.gone
        ? t('Its flight from NASA JPL’s trajectory, in 3D.')
        : p.group === 'earth'
          ? t('How high it is now and how fast it moves, from NASA JPL, in 3D.')
          : t('Its distance from Earth now, signal time and flight from NASA JPL, in 3D.');
  const note = p.summary ? t(p.summary) : null;
  // A short note ("Gale crater.") says less than Wikipedia's opening line, the definition readers want.
  const room = max - [...tail].length - 1;
  const lead = note && [...note].length >= max * 0.45 ? note : wikiLead ? leadSentences(wikiLead, room) : note ?? t(KIND_LABEL[p.craft.kind]);
  // A lead cut mid-sentence ends the description: a tail after "…" reads as a non-sentence.
  if (lead.endsWith('…')) return wikiLead && lead !== note ? leadSentences(wikiLead, max) : lead;
  const name = shortName(p.craft.name);
  const candidates = lead.includes(name) ? [`${lead} ${tail}`, lead] : [`${name}: ${lead} ${tail}`, `${lead} ${tail}`, lead];
  return candidates.find(d => [...d].length <= max) ?? leadSentences(lead, max);
}

export function stepText(t: Translate, s: FlightStep): string {
  switch (s.kind) {
    case 'launch':
      return s.vehicle && s.pad ? t('Launched on {vehicle} from {pad}', { vehicle: s.vehicle, pad: s.pad }) : t('Launch');
    case 'flyby': return t('Flies past {body}, {km, distance} away', { body: bodyName(t, s.body), km: s.km });
    case 'arrival': return t('Arrives at {body}', { body: bodyName(t, s.body) });
    case 'landing': return s.body === 'moon' ? t('Lands on the Moon') : t('Lands on {body}', { body: bodyName(t, s.body) });
    case 'crossing':
      return s.shell === 'heliopause'
        ? t('Crosses the heliopause into interstellar space, {au} AU from the Sun', { au: s.au.toLocaleString(t.intl) })
        : t('Crosses the termination shock, where the solar wind slows, {au} AU from the Sun', { au: s.au.toLocaleString(t.intl) });
    case 'begins': return t('JPL’s track of it begins');
    case 'ends': return t('JPL’s track of it ends');
  }
}

export function planetTitle(t: Translate, p: PlanetPage): string {
  const name = bodyName(t, p.planet.key);
  if (p.planet.key === 'mars') return t('How far is Mars from Earth right now? Rovers and orbiters');
  return fit([t('How far is {planet} from Earth right now? Live distance', { planet: name }), t('{planet} from Earth right now', { planet: name })], CJK.has(t.locale) ? 32 : TITLE_MAX);
}

export function planetDescription(t: Translate, p: PlanetPage): string {
  const planet = bodyName(t, p.planet.key);
  const max = CJK.has(t.locale) ? 90 : 160;
  const tail = p.planet.key === 'mars'
    ? t('With the rovers on its surface, the orbiters around it and every landing site.')
    : t('With the spacecraft there now and the ones that flew past.');
  if (!p.now) return [`${t('How far {planet} is from Earth, from NASA JPL.', { planet })} ${tail}`].find(d => [...d].length <= max) ?? tail;
  const lead = t('{planet} is {distance} from Earth right now; its light takes {light} to reach us.', {
    planet, distance: bigKm(t, p.now.earthKm), light: lightTime(p.now.lightSec, t),
  });
  return [`${lead} ${tail}`, lead].find(d => [...d].length <= max) ?? lead;
}
