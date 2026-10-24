import type { Translate } from '@/lib/core/i18n/translator';
import { bodyName } from './copy';
import { planetEntry } from './planets';
import { KIND_LABEL, ROSTER_GROUPS, rosterCraft } from './roster';
import { MISSION_NOTES } from '@/lib/space/craft/mission-notes';
import { LANDING_SITES } from '@/lib/space/craft/landing-sites';

/** The /map page whose picture of the space view sits behind a card. */
const PICTURE: Record<string, string> = { mars: 'mars-3d', moon: 'moon-3d' };

/** A space page's share card (`/og?space=craft:curiosity-rover`): fixed words only, nothing live. */
export function spaceCard(param: string, t: Translate) {
  const [kind, slug] = param.split(':');
  if (kind === 'index') {
    return { kicker: 'TAKIP', title: t('Spacecraft'), subtitle: t('Every spacecraft, rover and lander we can place, and where each one is now.'), picture: 'spacecraft-tracker' };
  }
  if (kind === 'planet') {
    const p = planetEntry(slug);
    if (!p) return null;
    return {
      kicker: p.key === 'pluto' ? t('Dwarf planet') : t('Planet'),
      title: bodyName(t, p.key),
      subtitle: t('How far it is from Earth right now, and the spacecraft that went there.'),
      picture: PICTURE[p.key] ?? 'solar-system-3d',
    };
  }
  const c = kind === 'craft' ? rosterCraft(slug) : null;
  if (!c) return null;
  const site = c.site ? LANDING_SITES[c.site.world].find(s => s.id === c.site!.id) : undefined;
  const summary = (c.horizons !== undefined ? MISSION_NOTES[c.horizons]?.summary : undefined) ?? c.summary ?? site?.note;
  const group = ROSTER_GROUPS.find(g => g.craft.includes(c))?.id ?? '';
  return {
    kicker: t(KIND_LABEL[c.kind]),
    title: c.name,
    subtitle: summary ? t(summary) : t('Where it is now, in 3D.'),
    picture: PICTURE[group] ?? 'spacecraft-tracker',
  };
}
