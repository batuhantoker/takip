import { eventArticle } from '@/lib/platform/site/events/article';
import { C_KM_S, LY_KM } from '@/lib/space/astro';
import { deepSkyImage, deepSkyUrl } from '@/lib/space/deep/deep-sky';
import { LIVE_IMAGES, liveImagePath } from '../live-images';
import type { JourneyStop } from './journey';
import { fleetNow, planetNow, type CraftNow, type PlanetNow } from './live';
import { PLANETS, type PlanetEntry } from './planets';

/** TAKIP — what the space overview pages fill in at render: distances measured now and each stop's picture. */

export interface Picture {
  src: string;
  /** Whole on black (a globe, a craft) rather than cropped to fill (a nebula). */
  contain: boolean;
  credit: string;
  href?: string;
  illustration?: boolean;
}

export interface PlacedStop {
  stop: JourneyStop;
  picture: Picture | null;
  /** From Earth, measured at `at`; else the catalogued distance from the Sun. */
  km: number | null;
  lightSec: number | null;
  at: number | null;
}

const WIKIPEDIA = 'Wikipedia';

async function wikiPicture(title: string, fill = false): Promise<Picture | null> {
  const a = await eventArticle(title, 'en');
  const src = a?.large ?? a?.image?.src;
  return a && src ? { src, contain: !fill, credit: WIKIPEDIA, href: a.url } : null;
}

function stopPicture(stop: JourneyStop): Promise<Picture | null> | Picture | null {
  const p = stop.picture;
  if (p.kind === 'wiki') return wikiPicture(p.title, p.fill);
  if (p.kind === 'live') return { src: liveImagePath(p.id), contain: true, credit: LIVE_IMAGES[p.id].credit };
  if (p.kind === 'file') return { src: p.src, contain: false, credit: p.credit, illustration: p.illustration };
  const img = deepSkyImage(p.id);
  return img ? { src: deepSkyUrl(p.id), contain: false, credit: img.credit, href: img.page } : null;
}

export async function placeStops(stops: JourneyStop[]): Promise<PlacedStop[]> {
  const live = stops.some(s => s.live?.kind === 'craft') ? fleetNow() : Promise.resolve(null);
  const [fleet, ...rest] = await Promise.all([live, ...stops.map(async s => ({
    picture: await stopPicture(s),
    body: s.live?.kind === 'body' ? await planetNow(s.live.key) : null,
  }))]);
  return stops.map((stop, i) => {
    const { picture, body } = rest[i];
    const craft = stop.live?.kind === 'craft' ? fleet?.craft.find(c => c.id === (stop.live as { id: number }).id) : null;
    if (body) return { stop, picture, km: body.earthKm, lightSec: body.lightSec, at: body.at };
    if (craft) return { stop, picture, km: craft.earthKm, lightSec: craft.lightSec, at: fleet!.at };
    const km = stop.ly !== undefined ? stop.ly * LY_KM : null;
    return { stop, picture, km, lightSec: km !== null ? km / C_KM_S : null, at: null };
  });
}

export interface PlanetCard { planet: PlanetEntry; now: PlanetNow | null; picture: Picture | null }

export function planetCards(): Promise<PlanetCard[]> {
  return Promise.all(PLANETS.map(async planet => {
    const [now, picture] = await Promise.all([planetNow(planet.key), wikiPicture(planet.wiki)]);
    return { planet, now, picture };
  }));
}

export interface SpaceNow {
  at: number;
  farthest: CraftNow | null;
  webb: CraftNow | null;
  nearest: { card: PlanetCard; now: PlanetNow } | null;
}

/** Voyager 1, Webb and whichever planet is nearest Earth now; null when JPL's answers aren't in yet. */
export async function spaceNow(cards: PlanetCard[]): Promise<SpaceNow | null> {
  const fleet = await fleetNow();
  const nearest = cards.flatMap(card => (card.now ? [{ card, now: card.now }] : [])).sort((a, b) => a.now.earthKm - b.now.earthKm)[0] ?? null;
  const farthest = fleet?.craft.find(c => c.id === -31) ?? null;
  const webb = fleet?.craft.find(c => c.id === -170) ?? null;
  if (!farthest && !webb && !nearest) return null;
  return { at: fleet?.at ?? nearest?.now.at ?? Date.now(), farthest, webb, nearest };
}
