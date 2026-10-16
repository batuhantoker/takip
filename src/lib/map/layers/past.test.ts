import { describe, expect, it } from 'vitest';
import { needsLive } from './past';

describe('needsLive', () => {
  it('sends History back to live for any data layer, not for terrain or stars', () => {
    expect(needsLive('earthquakes', 'history')).toBe(true);
    expect(needsLive('satellites', 'history')).toBe(true);
    expect(needsLive('terrain_3d', 'history')).toBe(false);
    expect(needsLive('sky_stars', 'history')).toBe(false);
  });

  it('keeps Replay for what it replays and for reference layers, and leaves it for live feeds', () => {
    for (const layer of ['flights', 'maritime', 'ships_cargo', 'satellites', 'sat_military', 'sat_daily', 'cables']) expect(needsLive(layer, 'replay')).toBe(false);
    for (const layer of ['earthquakes', 'transit', 'traffic', 'cctv', 'live_news', 'airport_weather']) expect(needsLive(layer, 'replay')).toBe(true);
  });
});
