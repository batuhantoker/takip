import { mapHref } from '../map-link';
import { LANDING_SITES, type LandingSite } from '@/lib/space/craft/landing-sites';
import { SKY_BODIES, type SkyBodyDef } from '@/lib/space/sky';
import { allFlights } from './flights';
import { fleetNow, marsRovers, planetNow, type CraftNow, type PlanetNow, type RoverNow } from './live';
import { planetEntry, type PlanetEntry, type PlanetKey } from './planets';
import { craftByHorizons, craftBySite, ROSTER, type RosterCraft } from './roster';

/**
 * TAKIP — what a planet's page says: how far it is now (JPL Horizons), the craft there now, the ones whose
 * flights the space view has fetched that went past or arrived, and on Mars the landing sites and rovers.
 */

export interface PlanetVisit {
  id: number;
  name: string;
  craft: RosterCraft | null;
  kind: 'flyby' | 'arrival' | 'landing';
  jd: number;
  km: number | null;
  /** After the flight was fetched: JPL's prediction. */
  expected: boolean;
}

export interface PlanetPage {
  planet: PlanetEntry;
  body: SkyBodyDef;
  now: PlanetNow | null;
  /** Craft JPL Horizons places at it now, and when; landers are with the landing sites. */
  there: { at: number; craft: (CraftNow & { page: RosterCraft | null })[] } | null;
  visits: PlanetVisit[];
  sites: { site: LandingSite; craft: RosterCraft | null }[];
  rovers: (RoverNow & { page: RosterCraft | null })[];
}

/** A craft's first pass of the planet, and its arrival or landing, but not every pass of a long tour. */
function visits(key: PlanetKey): PlanetVisit[] {
  const out: PlanetVisit[] = [];
  for (const f of allFlights()) {
    const seen = new Set<string>();
    for (const s of f.steps) {
      if ((s.kind !== 'flyby' && s.kind !== 'arrival' && s.kind !== 'landing') || s.body !== key || seen.has(s.kind)) continue;
      seen.add(s.kind);
      out.push({ id: f.id, name: craftByHorizons(f.id)?.name ?? f.name, craft: craftByHorizons(f.id), kind: s.kind, jd: s.jd, km: s.kind === 'flyby' ? s.km : null, expected: s.jd > f.fetchedJd });
    }
  }
  return out.sort((a, b) => a.jd - b.jd);
}

export async function loadPlanetPage(key: string): Promise<PlanetPage | null> {
  const planet = planetEntry(key);
  const body = planet && SKY_BODIES.find(b => b.key === planet.key);
  if (!planet || !body) return null;
  const [now, fleet, rovers] = await Promise.all([planetNow(planet.key), fleetNow(), planet.key === 'mars' ? marsRovers() : []]);
  const world = planet.key === 'mars' ? 'mars' : null;
  return {
    planet,
    body,
    now,
    there: fleet && { at: fleet.at, craft: fleet.craft.filter(c => c.region === planet.key && !craftByHorizons(c.id)?.site).map(c => ({ ...c, page: craftByHorizons(c.id) })) },
    visits: visits(planet.key),
    sites: world ? LANDING_SITES[world].map(site => ({ site, craft: craftBySite(world, site.id) })) : [],
    rovers: rovers.map(r => ({ ...r, page: ROSTER.find(c => c.rover === r.key) ?? null })),
  };
}

export function planetOpenPath(p: PlanetPage): string {
  const mode = p.planet.focus === 'solar'
    ? { view: 'space' as const, focus: 'solar' as const, select: { kind: 'body' as const, key: p.planet.key } }
    : { view: 'space' as const, focus: p.planet.focus };
  return mapHref({ layers: [], mode });
}
