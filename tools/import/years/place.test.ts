import { describe, expect, it } from 'vitest';
import { GeoPrec } from '@takip/db';
import type { ArticlePoint, GeoIndex, Hit, ItemPoint } from '../geo/geo-index';
import { byMethod, classify, fromPlaces, type Linked, placeAccepted, type PlaceInput } from './place';

const items: Record<number, ItemPoint> = {
  1: { qid: 1, lon: 16.37, lat: 48.21, country: 'AT', kind: 'settlement' }, // Vienna
  2: { qid: 2, lon: 16.33, lat: 48.27, country: 'AT', kind: 'event' }, // Battle of Vienna
  3: { qid: 3, lon: 14.5, lat: 47.5, country: 'AT', kind: 'country' },
  4: { qid: 4, lon: -122.0, lat: 37.3, country: 'US', kind: null }, // a company's head office
  5: { qid: 5, lon: 16.4, lat: 48.3, country: 'AT', kind: 'admin' }, // a district around Vienna
  6: { qid: 6, lon: 17.1, lat: 48.15, country: 'SK', kind: 'settlement' }, // Bratislava, 55 km away
  7: { qid: 7, lon: 2.35, lat: 48.86, country: 'FR', kind: 'settlement' }, // Paris
};
const index: GeoIndex = {
  item: q => items[q] ?? null,
  articles: (): ArticlePoint[] => [],
  articleByTitle: () => null,
  places: (): Hit[] => [],
  country: c => (c === 'AT' || c === 'austria' ? { iso2: 'AT', point: { lon: 14.5, lat: 47.5 } } : c === 'FR' ? { iso2: 'FR', point: { lon: 2.2, lat: 46.2 } } : null),
};
const link = (qid: number | null, title: string) => classify(index, 'en', { title, qid }, () => false);

describe('classify', () => {
  it('reads what each linked article is from the geo index', () => {
    expect([link(1, 'Vienna'), link(2, 'Battle of Vienna'), link(3, 'Austria'), link(4, 'Apple Inc.'), link(5, 'Wien-Umgebung'), link(null, 'Austria'), link(null, 'Nobody')].map(l => [l.role, l.kind])).toEqual([
      ['place', 'settlement'], ['event', 'event'], ['country', 'country'], ['coords', 'unknown'], ['place', 'admin2'], ['country', 'country'], ['none', undefined],
    ]);
  });
});

describe('fromPlaces', () => {
  const [vienna, district, bratislava, paris] = [link(1, 'Vienna'), link(5, 'Wien-Umgebung'), link(6, 'Bratislava'), link(7, 'Paris')];
  it('takes the finest place when the others contain it', () => {
    expect(fromPlaces([district, vienna], null, 'place')).toMatchObject({ method: 'place-link', geoPrec: GeoPrec.city, detail: 'Vienna', placedAt: 'town it links, Vienna' });
  });
  it('takes the middle of nearby towns and refuses far-apart ones', () => {
    expect(fromPlaces([vienna, bratislava], null, 'place')).toMatchObject({ method: 'place-links-middle', geoPrec: GeoPrec.approximate });
    expect(fromPlaces([vienna, paris], null, 'place')).toBeNull();
  });
  it("lets the page's country pick among towns abroad", () => {
    expect(fromPlaces([paris, vienna], ['AT'], 'place')).toMatchObject({ detail: 'Vienna' });
  });
});

describe('byMethod', () => {
  const x = (links: Linked[], extra: Partial<PlaceInput> = {}): PlaceInput => ({ lang: 'en', text: '', year: 1683, links, ctx: [], countries: null, ...extra });
  it('places by the linked event and leaves out a hidden one', () => {
    const ev = link(2, 'Battle of Vienna');
    expect(byMethod(index, x([ev]), 'event-article')).toMatchObject({ lon: 16.33, geoPrec: GeoPrec.exact });
    expect(byMethod(index, x([ev], { hide: 2 }), 'event-article')).toBeNull();
  });
  it('places at one linked country, never at two', () => {
    expect(byMethod(index, x([link(3, 'Austria')]), 'country-link')).toMatchObject({ geoPrec: GeoPrec.country });
    expect(byMethod(index, x([link(3, 'Austria'), link(null, 'Nobody')]), 'country-link')).not.toBeNull();
    expect(byMethod(index, x([], { countries: ['AT'] }), 'country-page')).toMatchObject({ lon: 14.5, geoPrec: GeoPrec.country });
  });
});

describe('placeAccepted', () => {
  const x = (links: Linked[]): PlaceInput => ({ lang: 'en', text: '', year: 1990, links, ctx: [], countries: null });
  const area = (iso2: string) => ({ AT: 83_879, FR: 551_695 })[iso2] ?? null;
  it('marks a town only linked, not put in by the text, as roughly there', () => {
    expect(placeAccepted(index, x([link(1, 'Vienna')]), area)).toMatchObject({ method: 'place-link', geoPrec: GeoPrec.approximate, placedAt: 'area around the town it links, Vienna' });
    expect(placeAccepted(index, x([{ ...link(1, 'Vienna'), loc: true }]), area)).toMatchObject({ method: 'place-in', geoPrec: GeoPrec.city });
  });
  it('places at a linked country only when it is small', () => {
    expect(placeAccepted(index, x([link(3, 'Austria')]), area)).toMatchObject({ method: 'country-link', geoPrec: GeoPrec.country });
    expect(placeAccepted(index, x([classify(index, 'en', { title: 'France', qid: null }, () => false)]), area)).toBeNull();
  });
});
