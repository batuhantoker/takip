import { describe, expect, it } from 'vitest';
import { admitRoadCondition, parseRoadCondition, roadConditionLine, type RoadCondition } from './road-condition';

const NOW = Date.parse('2026-10-12T21:00:00Z');
const wet: RoadCondition = { surface: 'Wet', road_temp: 7.5, air_temp: 7.2, observed_at: '2026-10-12T20:48:00Z', station: 'Jõhvi', distance_km: 0, source: 'Transpordiamet' };

describe('admitRoadCondition', () => {
  it('keeps a recent reading from a nearby paired station', () => {
    expect(admitRoadCondition(wet, NOW)).toBe(wet);
  });

  it('drops a station over 10 km away, a reading over 2 hours old, or one from the future', () => {
    expect(admitRoadCondition({ ...wet, distance_km: 12 }, NOW)).toBeNull();
    expect(admitRoadCondition({ ...wet, observed_at: '2026-10-12T18:59:00Z' }, NOW)).toBeNull();
    expect(admitRoadCondition({ ...wet, observed_at: '2026-10-12T21:30:00Z' }, NOW)).toBeNull();
    expect(admitRoadCondition({ ...wet, surface: '' }, NOW)).toBeNull();
  });
});

describe('roadConditionLine', () => {
  it('reads as one line, with distance only from 1 km', () => {
    expect(roadConditionLine(wet, NOW)).toBe('Road wet · surface 7.5 °C · air 7.2 °C · 12 min ago');
    expect(roadConditionLine({ ...wet, distance_km: 3.24, observed_at: '2026-10-12T19:30:00Z' }, NOW))
      .toBe('Road wet · surface 7.5 °C · air 7.2 °C · station 3.2 km away · 1 h 30 min ago');
  });
});

describe('parseRoadCondition', () => {
  it('accepts the object or its JSON, and nothing else', () => {
    expect(parseRoadCondition(JSON.stringify(wet))).toEqual(wet);
    expect(parseRoadCondition(wet)).toBe(wet);
    expect(parseRoadCondition('{')).toBeNull();
    expect(parseRoadCondition(undefined)).toBeNull();
  });
});
