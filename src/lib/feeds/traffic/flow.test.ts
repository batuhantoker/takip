import { describe, expect, it, vi } from 'vitest';
import { flowPopupHtml, flowTip } from './describe';
import { createFlowTiles } from './flow-tiles';
import { flowLevel, isTileAddress, tomtomFlowUrl } from './sources/tomtom';
import { TRAFFIC_REFRESH_MS } from './types';

describe('TomTom flow levels', () => {
  it('tints below 65% of free flow, harder below 40%, and closed roads as jams', () => {
    expect([0.8, 0.65, 0.64, 0.39].map(traffic_level => flowLevel({ traffic_level }))).toEqual([null, null, 'slow', 'jam']);
    expect(flowLevel({ traffic_level: 1, road_closure: true })).toBe('jam');
    expect(flowLevel({})).toBeNull();
  });
});

describe('TomTom flow tiles', () => {
  it('asks for the relative style with the tags the layer reads', () => {
    const url = tomtomFlowUrl(12, 2105, 1347, 'k/y');
    expect(url).toMatch(/\/traffic\/map\/4\/tile\/flow\/relative\/12\/2105\/1347\.pbf\?key=k%2Fy&/);
    expect(url).toContain('tags=[traffic_level,traffic_road_coverage,left_hand_traffic,road_closure,road_type]');
  });

  it('accepts only real tile addresses up to the source max zoom', () => {
    expect(isTileAddress(10, 1023, 0)).toBe(true);
    expect(isTileAddress(10, 1024, 0)).toBe(false);
    expect(isTileAddress(16, 0, 0)).toBe(false);
    expect(isTileAddress(10.5, 0, 0)).toBe(false);
  });

  const setup = (perDay = 10) => {
    let t = Date.parse('2026-10-15T12:00:00Z');
    const fetchTile = vi.fn(async () => new Response(new Uint8Array([1, 2, 3])));
    const tile = createFlowTiles('key', { fetchTile, now: () => t, perDay });
    return { tile, fetchTile, advance: (ms: number) => { t += ms; } };
  };

  it('serves one upstream tile to everyone for a refresh period, then fetches it again', async () => {
    const { tile, fetchTile, advance } = setup();
    expect(new Uint8Array((await tile(10, 1, 2))!)).toEqual(new Uint8Array([1, 2, 3]));
    await tile(10, 1, 2);
    expect(fetchTile).toHaveBeenCalledTimes(1);
    advance(TRAFFIC_REFRESH_MS);
    await tile(10, 1, 2);
    expect(fetchTile).toHaveBeenCalledTimes(2);
  });

  it('stops at the daily budget and starts again the next UTC day', async () => {
    const { tile, fetchTile, advance } = setup(2);
    await tile(10, 0, 0);
    await tile(10, 0, 1);
    expect(await tile(10, 0, 2)).toBeNull();
    expect(fetchTile).toHaveBeenCalledTimes(2);
    advance(24 * 3600_000);
    expect(await tile(10, 0, 2)).not.toBeNull();
  });

  it('answers nothing when TomTom refuses', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const tile = createFlowTiles('bad', { fetchTile: async () => new Response('Forbidden', { status: 403 }) });
    expect(await tile(10, 0, 0)).toBeNull();
    warn.mockRestore();
  });
});

describe('TomTom flow text', () => {
  it('names the road class and the share of free flow', () => {
    expect(flowTip({ road_type: 'Motorway', traffic_level: 0.42 })).toMatchObject({ name: 'Motorway', meta: '42% of free-flow speed · TomTom' });
    expect(flowTip({ road_closure: true }).meta).toBe('Closed · TomTom');
  });

  it('says a closed road is closed rather than giving a speed', () => {
    const html = flowPopupHtml({ road_type: 'Major road', traffic_level: 0, road_closure: true });
    expect(html).toContain('Road closed');
    expect(html).not.toContain('Of free flow');
  });
});
