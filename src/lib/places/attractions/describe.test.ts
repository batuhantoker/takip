import { describe, expect, it } from 'vitest';
import { attractionPopupHtml, attractionTip } from './describe';

// Shaped like a /api/things-to-do feature's properties.
const LOUVRE = { id: 'Q19675', k: 'museum', name: 'Louvre Museum', l: 180, h: 1, wl: 'en' };

describe('attractionTip', () => {
  it('names the place, its kind and World Heritage', () => {
    expect(attractionTip(LOUVRE)).toEqual({ key: 'attraction:Q19675', name: 'Louvre Museum', meta: 'Museum · World Heritage' });
    expect(attractionTip({ id: 'Q1', k: 'nonsense', name: '' }).name).toBe('Landmark');
  });
});

describe('attractionPopupHtml', () => {
  it('links its Wikipedia article and its Wikidata item', () => {
    const html = attractionPopupHtml(LOUVRE);
    expect(html).toContain('https://www.wikidata.org/wiki/Special:GoToLinkedPage/enwiki/Q19675');
    expect(html).toContain('https://www.wikidata.org/wiki/Q19675');
    expect(html).toContain('World Heritage');
  });

  it('leaves out the Wikipedia link where no Wikipedia of ours has it, and escapes the name', () => {
    const html = attractionPopupHtml({ ...LOUVRE, wl: '', name: '<b>x</b>' });
    expect(html).not.toContain('GoToLinkedPage');
    expect(html).toContain('&lt;b&gt;x&lt;/b&gt;');
  });
});
