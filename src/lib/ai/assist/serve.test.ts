import { afterEach, describe, expect, it, vi } from 'vitest';
import { handleMessage, type McpContext } from '../mcp';
import { serveTool, serverLookup } from './serve';

const ORIGIN = 'https://takip.example';

function stubFetch(routes: Record<string, unknown>) {
  const seen: string[] = [];
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    seen.push(url);
    const hit = Object.entries(routes).find(([k]) => url.startsWith(k));
    return hit ? new Response(JSON.stringify(hit[1]), { status: 200 }) : new Response('{}', { status: 404 });
  }));
  return seen;
}

afterEach(() => { vi.unstubAllGlobals(); });

describe('the data tools on the server', () => {
  it('fetches a layer from the site\'s own route and searches it like the page does', async () => {
    const seen = stubFetch({
      [`${ORIGIN}/api/earthquakes`]: { earthquakes: [{ id: 'a', lat: 35.7, lng: 139.7, magnitude: 5.6, place: 'near Tokyo', time: Date.now() }], source: 'usgs+stale' },
    });
    const out = await serveTool('find', { layer: 'earthquakes', near: { lat: 35.68, lng: 139.69 }, radius_km: 100 }, serverLookup(ORIGIN));
    expect(out?.result.ok).toBe(true);
    expect(out?.result.summary).toMatch(/^1 of 1 earthquakes within 100 km of 35\.68, 139\.69 matched \(feed stale/);
    expect(out?.effects).toBeDefined();
    expect(seen).toEqual([`${ORIGIN}/api/earthquakes`]);
  });

  it('geocodes keylessly when the accounts API is not running, and links into the map', async () => {
    stubFetch({ 'https://photon.komoot.io/api': { features: [{ geometry: { coordinates: [28.97, 41.01] }, properties: { name: 'Istanbul', country: 'Türkiye', type: 'city' } }] } });
    const out = await serveTool('link', { place: 'Istanbul', layers: ['flights'] }, serverLookup(ORIGIN));
    expect((out?.result.data as { url: string }).url).toBe(`${ORIGIN}/?lat=41.0100&lon=28.9700&zoom=9.5&layers=flights`);
  });

  it('answers takip_* calls over MCP with no model key', async () => {
    stubFetch({ [`${ORIGIN}/api/war-alerts`]: { alerts: [{ id: 'x', label: 'Sirens', place: 'Haifa', lat: 32.8, lng: 35.0, active: true, since: Date.now() }] } });
    const ctx: McpContext = { creds: {}, ip: '127.0.0.1', origin: ORIGIN, signal: new AbortController().signal, maxWaitSeconds: 10 };
    const r = await handleMessage({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'takip_find', arguments: { layer: 'air_raid_alerts' } } }, ctx);
    const result = r?.result as { content: { text: string }[]; structuredContent: { items: { name: string }[] }; isError?: boolean };
    expect(result.isError).toBeUndefined();
    expect(result.structuredContent.items[0].name).toBe('Sirens: Haifa');
    const bad = await handleMessage({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'takip_find', arguments: { layer: 'unicorns' } } }, ctx);
    expect((bad?.result as { isError: boolean; content: { text: string }[] }).isError).toBe(true);
    expect((bad?.result as { content: { text: string }[] }).content[0].text).toMatch(/^UNKNOWN_LAYER/);
  });
});
