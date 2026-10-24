import { describe, expect, it } from 'vitest';
import { LANDING_SITES, LANDER_SITES } from '@/lib/space/craft/landing-sites';
import { MISSION_NOTES } from '@/lib/space/craft/mission-notes';
import { craftByHorizons, craftBySite, ROSTER, rosterCraft } from './roster';

// Not a craft of its own on the pages: it is part of Chandrayaan-3's.
const LEFT_OUT = new Set([-169]);

describe('spacecraft roster', () => {
  it('gives every craft a unique slug made of lower-case words', () => {
    const slugs = ROSTER.map(c => c.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const s of slugs) expect(s).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
  });

  it('names each Horizons craft and landing site once', () => {
    const ids = ROSTER.flatMap(c => (c.horizons === undefined ? [] : [c.horizons]));
    expect(new Set(ids).size).toBe(ids.length);
    const sites = ROSTER.flatMap(c => (c.site ? [`${c.site.world}:${c.site.id}`] : []));
    expect(new Set(sites).size).toBe(sites.length);
  });

  it('has a page for every noted craft and every landing site', () => {
    for (const id of Object.keys(MISSION_NOTES).map(Number)) if (!LEFT_OUT.has(id)) expect(craftByHorizons(id), String(id)).not.toBeNull();
    for (const [world, sites] of Object.entries(LANDING_SITES)) {
      for (const s of sites) expect(craftBySite(world as 'moon' | 'mars', s.id), s.id).not.toBeNull();
    }
  });

  it('points only at landing sites that exist, and agrees with the fleet on where landers came down', () => {
    for (const c of ROSTER.filter(x => x.site)) expect(LANDING_SITES[c.site!.world].some(s => s.id === c.site!.id), c.slug).toBe(true);
    for (const [id, l] of Object.entries(LANDER_SITES)) expect(craftByHorizons(Number(id))?.site).toEqual({ world: l.world, id: l.site });
  });

  it('has something to say about every craft', () => {
    for (const c of ROSTER) {
      const site = c.site && LANDING_SITES[c.site.world].find(s => s.id === c.site!.id);
      expect(c.summary || (c.horizons !== undefined && MISSION_NOTES[c.horizons]) || site, c.slug).toBeTruthy();
    }
    expect(rosterCraft('curiosity-rover')?.rover).toBe('curiosity');
  });
});
