import { describe, expect, it } from 'vitest';
import { feedProblems, feedState, feedWords, worst } from './feed-state';

const NOW = Date.parse('2026-10-16T12:00:00Z');
const quakes = { earthquakes: [{ id: 'a', lat: 1, lng: 1, magnitude: 3 }] };

describe('feed states', () => {
  it('tells live from stale, fallback, degraded, loading, off and down', () => {
    const at = (min: number) => NOW - min * 60_000;
    const mark = (m: object) => ({ '/api/earthquakes': { at: at(5), failedAt: null, keys: ['earthquakes'], ...m } });
    const base = { data: quakes, layersOn: { earthquakes: true }, now: NOW };
    expect(feedState('earthquakes', { ...base, marks: mark({}) })).toEqual({ state: 'live', ageMin: 5 });
    expect(feedState('earthquakes', { ...base, marks: mark({ at: at(90) }) }).state).toBe('stale');
    expect(feedState('earthquakes', { ...base, marks: mark({ failedAt: at(1), error: 'HTTP 502' }) }).state).toBe('stale');
    expect(feedState('earthquakes', { ...base, marks: mark({ source: 'usgs+stale' }) }).state).toBe('stale');
    expect(feedState('earthquakes', { ...base, marks: mark({ source: 'emsc-fallback' }) }).state).toBe('fallback');
    expect(feedState('earthquakes', { ...base, marks: mark({ error: 'EMSC down' }) }).state).toBe('degraded');
    expect(feedState('fires', { data: {}, layersOn: { fires: true }, marks: {}, now: NOW }).state).toBe('loading');
    expect(feedState('fires', { data: {}, layersOn: {}, marks: {}, now: NOW }).state).toBe('off');
    expect(feedState('fires', { data: {}, layersOn: { fires: true }, marks: { '/api/fires': { at: null, failedAt: at(1), error: 'HTTP 500', keys: [] } }, now: NOW }).state).toBe('unavailable');
  });

  it('reports the worst of several, in words, and lists only the problems', () => {
    expect(worst([{ state: 'live' }, { state: 'stale', ageMin: 40 }, { state: 'loading' }]).state).toBe('stale');
    expect(feedWords({ state: 'stale', ageMin: 40, note: '40 min old' })).toBe('stale, 40 min old');
    expect(feedWords({ state: 'live' })).toBe('');
    const problems = feedProblems(['earthquakes', 'fires'], { data: quakes, layersOn: { fires: true }, marks: {}, now: NOW });
    expect(problems).toEqual({ fires: 'loading' });
  });
});
