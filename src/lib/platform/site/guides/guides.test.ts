import { describe, expect, it } from 'vitest';
import { DEFAULT_LAYERS } from '@/lib/map/layers/defaults';
import { LAYER_PAGES } from '../layer-pages';
import { GUIDES } from './guides';

const slugs = new Set(LAYER_PAGES.map(p => p.slug));

describe('guides', () => {
  it('have their own slugs', () => {
    expect(new Set(GUIDES.map(g => g.slug)).size).toBe(GUIDES.length);
  });

  it.each(GUIDES.map(g => [g.slug, g] as const))('%s keeps to the search limits', (_, g) => {
    expect(g.title.length).toBeLessThanOrEqual(60);
    expect(g.description.length).toBeGreaterThanOrEqual(110);
    expect(g.description.length).toBeLessThanOrEqual(160);
    expect(g.sections.length).toBeGreaterThanOrEqual(3);
  });

  it.each(GUIDES.map(g => [g.slug, g] as const))('%s names layer pages and map layers that exist', (_, g) => {
    expect(g.layers.filter(s => !slugs.has(s))).toEqual([]);
    expect(g.open.layers.filter(k => !(k in DEFAULT_LAYERS))).toEqual([]);
  });

  it.each(GUIDES.map(g => [g.slug, g] as const))('%s carries the day it was checked', (_, g) => {
    expect(g.checked).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
