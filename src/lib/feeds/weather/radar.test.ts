import { describe, expect, it } from 'vitest';
import { parseRadarFrames, radarFrameAt } from './radar';

// Shaped from api.rainviewer.com/public/weather-maps.json, 2026-10-16.
const BODY = {
  host: 'https://tilecache.rainviewer.com',
  radar: {
    past: [
      { time: 1792130400, path: '/v2/radar/1792130400' },
      { time: 1792129800, path: '/v2/radar/1792129800' },
      { time: 1792131000, path: '/v2/radar/1792131000' },
    ],
    nowcast: [{ time: 1792131600, path: '/v2/radar/nowcast_abc' }],
  },
};

describe('parseRadarFrames', () => {
  it('reads the past frames oldest first, leaving the nowcast out', () => {
    const frames = parseRadarFrames(BODY);
    expect(frames.map(f => f.time)).toEqual([1792129800000, 1792130400000, 1792131000000]);
    expect(frames[0].tiles).toBe('https://tilecache.rainviewer.com/v2/radar/1792129800/512/{z}/{x}/{y}/2/1_1.png');
    expect(parseRadarFrames({})).toEqual([]);
  });
});

describe('radarFrameAt', () => {
  const frames = parseRadarFrames(BODY);
  it('picks the frame covering a time, and nothing outside the span', () => {
    expect(radarFrameAt(frames, 1792130700000)?.time).toBe(1792130400000);
    expect(radarFrameAt(frames, 1792131000000 + 5 * 60_000)?.time).toBe(1792131000000);
    expect(radarFrameAt(frames, 1792131000000 + 20 * 60_000)).toBeNull();
    expect(radarFrameAt(frames, 1792129800000 - 1)).toBeNull();
  });
});
