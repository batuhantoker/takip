import type { Translate } from '@/lib/core/i18n/translator';
import { DWARF_PLANETS, VISITORS, type OuterBodyDef, type VisitorDef } from '@/lib/space/deep/outer';
import { lightTime } from '@/lib/space/format';
import { mapHref } from '../map-link';
import { bigKm, descriptionMax, fit, titleMax } from './copy';
import { outerNow, type PlanetNow } from './live';
import { outerEntry, type OuterEntry } from './planets';

/** TAKIP — a dwarf planet's or interstellar visitor's page: how far it is now, worked out as the space view places it. */

export interface OuterPage {
  entry: OuterEntry;
  def: OuterBodyDef | VisitorDef;
  now: PlanetNow | null;
}

export async function loadOuterPage(key: string): Promise<OuterPage | null> {
  const entry = outerEntry(key);
  const def = entry && [...DWARF_PLANETS, ...VISITORS].find(b => b.key === entry.key);
  if (!entry || !def) return null;
  return { entry, def, now: await outerNow(entry.key) };
}

export const isVisitor = (def: OuterBodyDef | VisitorDef): def is VisitorDef => 'designation' in def;

/** Into the space view, flown out to it and its card open. */
export const outerOpenPath = (p: OuterPage) => mapHref({ layers: [], mode: { view: 'space', focus: 'solar', select: { kind: 'outer', key: p.entry.key } } });

export function outerTitle(t: Translate, p: OuterPage): string {
  const planet = p.def.name;
  return fit([t('How far is {planet} from Earth right now? Live distance', { planet }), t('{planet} from Earth right now', { planet })], titleMax(t));
}

export function outerDescription(t: Translate, p: OuterPage): string {
  const planet = p.def.name;
  const max = descriptionMax(t);
  const tail = isVisitor(p.def) ? t('An object from another star passing through the solar system, on its real path in 3D.') : t('A dwarf planet past Neptune, where it is now in 3D.');
  if (!p.now) return [`${planet}: ${tail}`].find(d => [...d].length <= max) ?? tail;
  const lead = t('{planet} is {distance} from Earth right now; its light takes {light} to reach us.', { planet, distance: bigKm(t, p.now.earthKm), light: lightTime(p.now.lightSec, t) });
  return [`${lead} ${tail}`, lead].find(d => [...d].length <= max) ?? lead;
}
