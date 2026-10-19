import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DESCRIPTION_RANGE, EN, TITLE_MAX } from '../copy/format';
import { allPlaces, placeBySlug } from '../gazetteer';
import { PORTS } from './ports';

// topics.test.ts runs without AIS_API_KEY, where no port page exists, so the copy is checked here.
describe('port pages', () => {
  beforeEach(() => vi.stubEnv('AIS_API_KEY', 'test'));
  afterEach(() => vi.unstubAllEnvs());

  const page = (slug: string) => {
    const place = placeBySlug('city', slug)!;
    return { place, page: PORTS.pages(place)[0] };
  };

  it('exist only where the server has an AIS key', () => {
    vi.stubEnv('AIS_API_KEY', '');
    expect(PORTS.pages(placeBySlug('city', 'rotterdam')!)).toEqual([]);
  });

  it('keep every indexed title and description within bounds, each title its own', () => {
    const copies = allPlaces().flatMap(place => PORTS.pages(place).filter(p => p.index).map(p => PORTS.header(place, p, EN)));
    expect(copies.length).toBeGreaterThan(100);
    expect(copies.filter(c => c.title.length > TITLE_MAX).map(c => c.title)).toEqual([]);
    expect(copies.filter(c => c.description.length < DESCRIPTION_RANGE[0] || c.description.length > DESCRIPTION_RANGE[1]).map(c => c.description)).toEqual([]);
    const titles = copies.map(c => c.title);
    expect(titles.filter((t, i) => titles.indexOf(t) !== i)).toEqual([]);
  });

  it('lead with what each port is', () => {
    const rotterdam = page('rotterdam');
    expect(rotterdam.page.index).toBe(true);
    expect(PORTS.header(rotterdam.place, rotterdam.page, EN).title).toBe('Rotterdam port live: container ships on a map');
    const istanbul = page('istanbul');
    expect(PORTS.header(istanbul.place, istanbul.page, EN).lede).toMatch(/^Istanbul lies on the Turkish Straits/);
    const sciacca = page('sciacca');
    expect(sciacca.page.index).toBe(false);
    expect(PORTS.header(sciacca.place, sciacca.page, EN).lede).toBe('By the World Port Index, Sciacca is a fishing harbour.');
  });
});
