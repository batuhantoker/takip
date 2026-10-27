/**
 * TAKIP — which Wikipedia article goes with a thing in the space view. Bodies
 * and landmarks have fixed titles; craft, stars and dwarf planets are looked
 * up with a word of context, which lands on "Juno (spacecraft)" rather than the
 * goddess and "Castor (star)" rather than the twin.
 */

import { pastMission } from './craft/past-missions';
import { deepSkyObject } from './deep/deep-sky';
import { NEARBY_GALAXIES } from './deep/features';
import type { SpaceSelection } from './selection';
import type { SkyKey } from './sky';

export interface WikiTopic { title?: string; q?: string }

const BODY: Record<SkyKey, string> = {
  sun: 'Sun', mercury: 'Mercury (planet)', venus: 'Venus', earth: 'Earth', moon: 'Moon', mars: 'Mars',
  jupiter: 'Jupiter', saturn: 'Saturn', uranus: 'Uranus', neptune: 'Neptune', pluto: 'Pluto',
};

const FEATURE: Record<string, string> = {
  heliopause: 'Heliosphere', 'termination-shock': 'Heliosphere', 'kuiper-belt': 'Kuiper belt',
  'gravitational-focus': 'Solar gravitational lens', 'oort-cloud': 'Oort cloud', 'sgr-a': 'Sagittarius A*',
  'milky-way': 'Milky Way', cmb: 'Cosmic microwave background', 'zone-of-avoidance': 'Zone of Avoidance', laniakea: 'Laniakea Supercluster', 'local-void': 'Local Void',
  'basin-shapley': 'Shapley Supercluster', 'basin-perseus-pisces': 'Perseus–Pisces Supercluster', 'basin-hercules': 'Hercules Supercluster', 'sculptor-void': 'Sculptor Void',
};

const VISITOR: Record<string, string> = { oumuamua: 'ʻOumuamua', borisov: '2I/Borisov', atlas: '3I/ATLAS' };

/** `name` is what the view calls the thing (a craft's, star's or body's display name). */
export function wikiTopic(sel: SpaceSelection, name?: string): WikiTopic | null {
  switch (sel.kind) {
    case 'body': return { title: BODY[sel.key] };
    case 'craft': {
      const past = pastMission(sel.id);
      if (past) return { title: past.wiki };
      return name ? { q: `${name} spacecraft` } : null;
    }
    case 'orbiter': return name ? { q: `${name} spacecraft` } : null;
    case 'rover': return name ? { title: `${name} (rover)` } : null;
    case 'site': return name ? { q: `${name} mission` } : null;
    case 'star': return name && !/^(HIP|HR|Gaia DR3) /.test(name) ? { q: `${name} star` } : null;
    case 'exohost': return { q: `${sel.name} star` };
    case 'outer': return VISITOR[sel.key] ? { title: VISITOR[sel.key] } : name ? { q: `${name} dwarf planet` } : null;
    case 'feature': {
      if (FEATURE[sel.id]) return { title: FEATURE[sel.id] };
      const pictured = deepSkyObject(sel.id);
      if (pictured && !pictured.feature) return { title: pictured.wiki };
      const g = NEARBY_GALAXIES.find(x => x.id === sel.id);
      if (g) return { q: `${g.name} galaxy` };
      if (sel.id.startsWith('scl:')) return { title: 'Supercluster' };
      if (sel.id.startsWith('void:')) return { title: name === 'Boötes Void' ? 'Boötes Void' : 'Void (astronomy)' };
      if (sel.id.startsWith('cosmos:')) return { q: sel.id.slice(7).replace(/\s*\(.*\)/, '') };
      return null;
    }
  }
}
