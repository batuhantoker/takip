import { describe, expect, it } from 'vitest';
import { DEFAULT_LAYERS } from '@/lib/map/layers/defaults';
import { availablePages, LAYER_PAGES, layerPage, openPath, SECTIONS } from './layer-pages';
import { TOPICS } from './places/topics/registry';

describe('LAYER_PAGES', () => {
  it('has unique, URL-safe slugs', () => {
    const slugs = LAYER_PAGES.map(p => p.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const s of slugs) expect(s).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it.each(LAYER_PAGES.map(p => [p.slug, p] as const))('%s fits search results and names real layers', (_, p) => {
    expect(p.title.length, p.title).toBeLessThanOrEqual(60);
    expect(p.description.length, p.description).toBeGreaterThanOrEqual(110);
    expect(p.description.length, p.description).toBeLessThanOrEqual(160);
    expect(SECTIONS.map(s => s.id)).toContain(p.section);
    for (const key of p.layers) expect(DEFAULT_LAYERS, key).toHaveProperty(key);
    for (const slug of p.related) expect(LAYER_PAGES.map(q => q.slug), slug).toContain(slug);
    expect(p.related).not.toContain(p.slug);
    for (const v of [p.view, ...(p.spots ?? []).map(s => s.view)].filter(v => !!v)) {
      expect(Math.abs(v.lat)).toBeLessThanOrEqual(90);
      expect(Math.abs(v.lon)).toBeLessThanOrEqual(180);
      expect(v.zoom).toBeGreaterThanOrEqual(1.5);
    }
    expect(p.shows.length).toBeGreaterThan(0);
    expect(p.layers.length > 0 || !!p.mode || !!p.panel || !!p.view, 'opens something').toBe(true);
    expect(p.sources.length).toBeGreaterThan(0);
    if (p.places) expect(TOPICS.map(x => x.id)).toContain(p.places);
  });

  it('leaves out pages whose layer needs a key the server lacks', () => {
    const gated = LAYER_PAGES.find(p => p.requiresEnv)!;
    expect(availablePages({}).map(p => p.slug)).not.toContain(gated.slug);
    expect(availablePages({ [gated.requiresEnv!]: 'x' }).map(p => p.slug)).toContain(gated.slug);
    expect(layerPage(gated.slug, {})).toBeUndefined();
  });

  it('opens the map with the page’s layers and what it follows', () => {
    const iss = layerPage('iss-tracker', {})!;
    const url = new URL(openPath(iss), 'http://x');
    expect(url.searchParams.get('track')).toBe('satellite:25544');
    expect(url.searchParams.get('layers')).toContain('sat_science');
  });

  it('opens around the visitor where the page says so, keeping its view as the fallback, but never at a spot', () => {
    const radar = layerPage('rain-radar', {})!;
    const url = new URL(openPath(radar), 'http://x');
    expect(url.searchParams.get('near')).toBe('6');
    expect(url.searchParams.get('lat')).toBe(radar.view!.lat.toFixed(4));
    expect(new URL(openPath(radar, { lat: 52.5, lon: 13.4, zoom: 8 }), 'http://x').searchParams.has('near')).toBe(false);
    expect(new URL(openPath(layerPage('hurricanes', {})!), 'http://x').searchParams.has('near')).toBe(false);
  });

  it('opens History on only the kinds a page is about', () => {
    const url = new URL(openPath(layerPage('plane-crashes', {})!), 'http://x');
    expect(url.searchParams.get('view')).toBe('history');
    expect(url.searchParams.get('families')).toBe('disaster');
    expect(url.searchParams.get('kinds')).toBe('accident.aviation');
    expect(new URL(openPath(layerPage('iss-tracker', {})!), 'http://x').searchParams.has('kinds')).toBe(false);
  });
});
