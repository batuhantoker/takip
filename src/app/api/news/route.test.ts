import { describe, it, expect } from 'vitest';
import { scoreRisk, findCoords } from './route';

describe('scoreRisk', () => {
  it('reports the terms that produced the score', () => {
    const r = scoreRisk('Missile strike reported near the frontline');
    expect(r.matched).toEqual(expect.arrayContaining(['missile', 'strike', 'frontline']));
    expect(r.score).toBe(1 + r.matched.length * 2);
  });

  it('scores unremarkable text at the floor', () => {
    expect(scoreRisk('Local council approves new library hours')).toEqual({ score: 1, matched: [] });
  });

  it('caps at 10 and stays deterministic', () => {
    const text = 'war missile strike attack nuclear invasion bomb drone killed destroyed';
    expect(scoreRisk(text).score).toBe(10);
    expect(scoreRisk(text)).toEqual(scoreRisk(text));
  });
});

describe('findCoords', () => {
  it('returns the preset anchor and names the term it matched', () => {
    expect(findCoords('Reports of shelling in Rafah, southern Gaza')).toEqual({
      coords: [31.416, 34.333], anchor: 'gaza',
    });
  });

  it('returns null when no place term is present', () => {
    expect(findCoords('Markets closed higher on Tuesday')).toBeNull();
  });

  /* The anchor is a territory centroid, so two different events in the same
     territory resolve to the same point. That is the limitation the payload's
     location_precision field exists to declare. */
  it('gives distinct events in one territory the same anchor', () => {
    expect(findCoords('strike in Rafah, Gaza')?.coords).toEqual(findCoords('aid convoy in Gaza City')?.coords);
  });
});
