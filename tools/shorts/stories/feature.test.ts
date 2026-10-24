import { describe, expect, it } from 'vitest';
import { LAYER_PAGES } from '../../../src/lib/platform/site/layer-pages';
import { filler, journeyOf, withLayers } from './feature';

const page = (slug: string) => LAYER_PAGES.find(p => p.slug === slug)!;

describe('journeyOf', () => {
  it('opens a space page on a lit view and flies to its own stop, or through every view past it', () => {
    expect(journeyOf(page('moon-3d'))).toEqual(['solar', 'moon']);
    expect(journeyOf(page('stars-and-galaxies'))).toEqual(['solar', 'stars', 'galaxy', 'universe']);
    expect(journeyOf(page('solar-system-3d'))).toEqual(['sun', 'solar']);
  });
  it('gives a long cut more than one stop', () => {
    expect(journeyOf(page('moon-3d'), true)).toEqual(['solar', 'moon', 'mars', 'sun']);
    expect(journeyOf(page('solar-system-3d'), true)).toEqual(['sun', 'solar', 'stars']);
    expect(journeyOf(page('night-sky'), true)).toEqual(['solar', 'stars', 'galaxy']);
  });
  it('takes the night sky into space, and leaves map pages on the map', () => {
    expect(journeyOf(page('night-sky'))).toEqual(['solar', 'stars']);
    expect(journeyOf(page('flight-tracker'))).toEqual([]);
  });
});

describe('withLayers', () => {
  it('names the base layers when a link names none, so the browser default never shows', () => {
    expect(withLayers('/?lat=20.0000&lon=0.0000&zoom=1.50')).toBe('/?lat=20.0000&lon=0.0000&zoom=1.50&layers=day_night,sky_stars');
    expect(withLayers('/?layers=flights')).toBe('/?layers=flights');
  });
});

describe('filler', () => {
  it('refuses lines about the video instead of the place', () => {
    expect(filler(['Chan Chan is next, another site on that same list.'])).toMatch(/next/);
    expect(filler(['The camera lands on the Peace of Westphalia, 1648.'])).toMatch(/camera/);
    expect(filler(['And Potosí, its page open.'])).toMatch(/page/);
  });
  it('passes a line that tells the place', () => {
    expect(filler(['Chan Chan, the largest adobe city in the Americas.', 'Potosí, whose silver bankrolled an empire.'])).toBeNull();
  });
});
