import { describe, expect, it } from 'vitest';
import type { ActiveLayers } from '@/lib/map/layers/defaults';
import { replayLayers } from './replay-layers';

describe('replayLayers', () => {
  it('keeps recorded traffic and reference layers, and pauses live-only ones', () => {
    const active = { flights: true, maritime: true, ships_underway: true, sat_comms: true, cables: true, wx_temperature: true, earthquakes: true, day_night: false } as unknown as ActiveLayers;
    expect(replayLayers(active)).toMatchObject({
      flights: true, maritime: true, ships_underway: true, sat_comms: true, cables: true, wx_temperature: false, earthquakes: false, day_night: false, conflict_zones: false,
    });
  });
});
