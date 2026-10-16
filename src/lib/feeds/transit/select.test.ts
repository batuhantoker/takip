import { describe, expect, it } from 'vitest';
import { feedsInView, isRoadFeed, type TransitFeed } from './select';
import { clampView, isTooWide, parseBbox, type Bbox } from './view';

const feed = (id: string, bbox: Bbox, size?: number): TransitFeed => ({ id, name: id, kind: 'gtfs-rt', url: `https://example.invalid/${id}`, bbox, size });

describe('feedsInView', () => {
  const city = feed('city', [28.5, 40.8, 29.5, 41.3], 3000);
  const shuttle = feed('shuttle', [28.95, 41.0, 29.0, 41.05], 4);
  const national = feed('national', [26, 36, 45, 42], 5000);
  const elsewhere = feed('elsewhere', [2.2, 48.8, 2.5, 48.9], 900);
  const view: Bbox = [28.8, 40.9, 29.2, 41.1];

  it('leaves out feeds that do not meet the view', () => {
    expect(feedsInView([elsewhere, city], view, 8).picked.map(f => f.id)).toEqual(['city']);
  });

  it("puts the city's own feed ahead of a shuttle and a national feed when capped", () => {
    expect(feedsInView([shuttle, national, city], view, 1)).toEqual({ picked: [city], skipped: 2 });
    expect(feedsInView([shuttle, national, city], view, 8).picked.map(f => f.id)).toEqual(['city', 'shuttle', 'national']);
  });

  it('takes the feeds of one stop graph together, as one of the capped slots', () => {
    const lines = ['ace', 'bdfm', 'g'].map(id => ({ ...feed(id, [28.8, 40.9, 29.2, 41.1], 140), graph: 'subway' }));
    expect(feedsInView([shuttle, ...lines, city], view, 2)).toEqual({ picked: [city, ...lines], skipped: 1 });
  });
});

describe('isRoadFeed', () => {
  it('is true only when every route runs on the road', () => {
    expect(isRoadFeed({ modes: ['bus'] })).toBe(true);
    expect(isRoadFeed({ modes: ['bus', 'trolleybus'] })).toBe(true);
    expect(isRoadFeed({ modes: ['tram', 'bus'] })).toBe(false);
    expect(isRoadFeed({})).toBe(false);
  });
});

describe('view helpers', () => {
  it('parses a bbox and refuses malformed ones', () => {
    expect(parseBbox('28.8,40.9,29.2,41.1')).toEqual([28.8, 40.9, 29.2, 41.1]);
    expect(parseBbox(null)).toBeNull();
    expect(parseBbox('1,2,3')).toBeNull();
    expect(parseBbox('29,41,28,40')).toBeNull();
    expect(parseBbox('a,b,c,d')).toBeNull();
  });

  it('cuts a wide view down around its centre and wraps the centre', () => {
    expect(clampView([20, 30, 40, 50])).toEqual([28.5, 39, 31.5, 41]);
    expect(isTooWide(clampView([20, 30, 40, 50]))).toBe(false);
    expect(isTooWide([20, 30, 40, 50])).toBe(true);
    const [w, , e] = clampView([389, 41, 390, 41.5]);
    expect([w, e]).toEqual([29, 30]);
    // Tilted: the bounds reach the horizon; the box goes around where the map is centred.
    expect(clampView([27, 40, 31, 47], [29, 41])).toEqual([27.5, 40, 30.5, 42]);
  });
});
