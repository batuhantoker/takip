import { describe, expect, it } from 'vitest';
import { intersectsAny, parseBbox } from './bbox';

describe('parseBbox', () => {
  it('reads west,south,east,north', () => {
    expect(parseBbox('-74.5,40.2,-73.5,41')).toEqual([[-74.5, 40.2, -73.5, 41]]);
  });

  it('rejects anything that is not four finite numbers', () => {
    expect(parseBbox('1,2,3')).toBeNull();
    expect(parseBbox('a,2,3,4')).toBeNull();
    expect(parseBbox('1,2,3,Infinity')).toBeNull();
  });

  it('clamps latitude and rejects an empty or upside-down box', () => {
    expect(parseBbox('0,-100,10,100')).toEqual([[0, -90, 10, 90]]);
    expect(parseBbox('0,10,10,10')).toBeNull();
    expect(parseBbox('0,20,10,10')).toBeNull();
  });

  it('splits an unwrapped view across the antimeridian into two boxes', () => {
    expect(parseBbox('170,50,190,60')).toEqual([[170, 50, 180, 60], [-180, 50, -170, 60]]);
  });

  it('treats west > east as crossing the antimeridian', () => {
    expect(parseBbox('170,50,-170,60')).toEqual([[170, 50, 180, 60], [-180, 50, -170, 60]]);
  });

  it('wraps a view that has been panned a whole turn', () => {
    expect(parseBbox('-434,40,-433,41')).toEqual([[-74, 40, -73, 41]]);
  });

  it('becomes the whole world when the view spans 360° or more', () => {
    expect(parseBbox('-200,-10,200,10')).toEqual([[-180, -10, 180, 10]]);
  });
});

describe('intersectsAny', () => {
  const bboxes = Float64Array.from([0, 0, 1, 1, 179, 10, 179.5, 11]);

  it('matches a feature that touches any box', () => {
    expect(intersectsAny(bboxes, 0, [[0.5, 0.5, 2, 2]])).toBe(true);
    expect(intersectsAny(bboxes, 0, [[1, 1, 2, 2]])).toBe(true);
    expect(intersectsAny(bboxes, 0, [[2, 2, 3, 3]])).toBe(false);
  });

  it('finds features on the far side of the antimeridian through the second box', () => {
    expect(intersectsAny(bboxes, 1, parseBbox('170,5,190,15')!)).toBe(true);
  });
});
