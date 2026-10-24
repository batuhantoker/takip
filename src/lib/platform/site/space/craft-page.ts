import { mapHref } from '../map-link';
import { LANDING_SITES, type LandingSite } from '@/lib/space/craft/landing-sites';
import { LAUNCHES, type Launch } from '@/lib/space/craft/launches';
import { MISSION_NOTES } from '@/lib/space/craft/mission-notes';
import { CRAFT_MODELS, type CraftModel } from '@/lib/space/craft/models';
import type { Region } from '@/lib/space/craft/fleet';
import type { SpaceSelection } from '@/lib/space/selection';
import type { SpaceFocus } from '@/lib/space/worlds';
import { flightSummary, type FlightSummary } from './flights';
import { fleetNow, marsRovers, type CraftNow, type RoverNow } from './live';
import { ROSTER_GROUPS, rosterCraft, type RosterCraft } from './roster';

/**
 * TAKIP — everything a spacecraft page says, gathered from the space view's own tables (mission notes, launches,
 * landing sites, NASA's 3D models), the flights it has fetched, and where JPL and NASA place the craft now.
 */

export interface CraftPage {
  craft: RosterCraft;
  group: string;
  agency: string | null;
  /** English, marked for translation: pass through t(). */
  summary: string | null;
  ended: number | null;
  launch: Launch | null;
  site: LandingSite | null;
  model: CraftModel | null;
  /** Where JPL Horizons places it, and when that was true. */
  now: (CraftNow & { at: number }) | null;
  rover: RoverNow | null;
  flight: FlightSummary | null;
  related: RosterCraft[];
}

const RELATED = 6;

const GROUP_OF = new Map(ROSTER_GROUPS.flatMap(g => g.craft.map(c => [c.slug, g.id] as const)));
const GROUP_FOCUS: Record<string, SpaceFocus> = { mars: 'mars', moon: 'moon', earth: 'earth' };

const focusFor = (r: Region): SpaceFocus =>
  r === 'moon' ? 'moon' : r === 'mars' ? 'mars' : r === 'earth-orbit' || r === 'cislunar' ? 'earth' : 'solar';

/** The next few in its group, wrapping round, so every page in a group is linked from others. */
function related(c: RosterCraft): RosterCraft[] {
  const list = ROSTER_GROUPS.find(g => g.id === GROUP_OF.get(c.slug))?.craft ?? [];
  const i = list.indexOf(c);
  return Array.from({ length: Math.min(RELATED, list.length - 1) }, (_, k) => list[(i + 1 + k) % list.length]);
}

export async function loadCraftPage(slug: string): Promise<CraftPage | null> {
  const craft = rosterCraft(slug);
  if (!craft) return null;
  const note = craft.horizons !== undefined ? MISSION_NOTES[craft.horizons] : undefined;
  const site = craft.site ? LANDING_SITES[craft.site.world].find(s => s.id === craft.site!.id) ?? null : null;
  const [fleet, rovers] = await Promise.all([
    craft.horizons !== undefined ? fleetNow() : null,
    craft.rover ? marsRovers() : [],
  ]);
  const now = fleet && craft.horizons !== undefined ? fleet.craft.find(x => x.id === craft.horizons) : undefined;
  return {
    craft,
    group: GROUP_OF.get(craft.slug) ?? '',
    agency: note?.agency ?? craft.agency ?? site?.agency ?? null,
    summary: note?.summary ?? craft.summary ?? site?.note ?? null,
    ended: note?.ended ?? null,
    launch: craft.horizons !== undefined ? LAUNCHES[craft.horizons] ?? null : null,
    site,
    model: craft.horizons !== undefined ? CRAFT_MODELS[craft.horizons] ?? null : null,
    now: now && fleet ? { ...now, at: fleet.at } : null,
    rover: rovers.find(r => r.key === craft.rover) ?? null,
    flight: craft.horizons !== undefined ? flightSummary(craft.horizons) : null,
    related: related(craft),
  };
}

/** What "Open in 3D" selects: NASA's live rover, else where it came down, else the craft where Horizons has it. */
export function craftSelection(p: Pick<CraftPage, 'craft' | 'rover' | 'site' | 'now' | 'group'>): { focus: SpaceFocus; select: SpaceSelection } | null {
  const { craft } = p;
  if (craft.rover && p.rover) return { focus: 'mars', select: { kind: 'rover', id: craft.rover } };
  if (craft.site && p.site) return { focus: craft.site.world, select: { kind: 'site', world: craft.site.world, id: craft.site.id } };
  if (craft.horizons === undefined) return null;
  return { focus: p.now ? focusFor(p.now.region) : GROUP_FOCUS[p.group] ?? 'solar', select: { kind: 'craft', id: craft.horizons } };
}

export function craftOpenPath(p: CraftPage): string {
  const s = craftSelection(p);
  return mapHref({ layers: [], mode: s ? { view: 'space', ...s } : { view: 'space', focus: GROUP_FOCUS[p.group] ?? 'solar' } });
}

/** A flight to watch: one the space view has fetched, or a craft out beyond Earth orbit now. */
export function craftReplayPath(p: CraftPage): string | null {
  const id = p.craft.horizons;
  if (id === undefined || !(p.flight || (p.now && p.now.region !== 'earth-orbit'))) return null;
  return mapHref({ layers: [], mode: { view: 'space', focus: 'solar', replay: id } });
}

/** Landed on the Moon or Mars (it stays where it came down, whatever Horizons says of it). */
export const isLanded = (p: Pick<CraftPage, 'site'>) => p.site !== null;
