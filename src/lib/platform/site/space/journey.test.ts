import { describe, expect, it } from 'vitest';
import { parseViewModeLink } from '@/lib/map/view-mode-link';
import { DEEP_SKY, deepSkyImage } from '@/lib/space/deep/deep-sky';
import { DEEP_JOURNEY, DEEP_SKY_TEASER, deepSkyHref, deepSkyRest, SOLAR_JOURNEY, stopHref } from './journey';

const parse = (href: string) => parseViewModeLink(new URLSearchParams(href.split('?')[1]));

describe('the way out', () => {
  it('has a picture for every deep-sky stop', () => {
    for (const s of [...SOLAR_JOURNEY, ...DEEP_JOURNEY]) {
      if (s.picture.kind === 'deep') expect(deepSkyImage(s.picture.id), s.id).toBeTruthy();
    }
  });

  it('shows every deep-sky picture once, on the way out or in the gallery', () => {
    const shown = [...DEEP_JOURNEY.map(s => s.id), ...deepSkyRest().flatMap(g => g.items.map(d => d.id))];
    expect(new Set(shown).size).toBe(shown.length);
    for (const d of DEEP_SKY) expect(shown, d.id).toContain(d.id);
    for (const id of DEEP_SKY_TEASER) expect(DEEP_SKY.some(d => d.id === id), id).toBe(true);
  });

  it('opens the 3D view on what each link names', () => {
    for (const d of DEEP_SKY) {
      const link = parse(deepSkyHref(d));
      expect(link?.view === 'space' && link.select, d.id).toEqual({ kind: 'feature', id: d.feature ?? d.id });
    }
    for (const s of [...SOLAR_JOURNEY, ...DEEP_JOURNEY]) {
      const link = parse(stopHref(s));
      expect(link?.view, s.id).toBe('space');
      if (s.mode.view === 'space' && s.mode.select) expect(link?.view === 'space' && link.select, s.id).toEqual(s.mode.select);
    }
  });
});
