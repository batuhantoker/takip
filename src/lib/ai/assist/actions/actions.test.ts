import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseBoundaries } from '@/lib/places/areas/boundaries';
import { mcpTool, signature } from '../defs/define';
import { MCP_DEFS, TOOL_DEFS, TOOL_NAMES, toolGuide } from '../tool-defs';
import { runCall, type Highlight, type Site } from '../tools';
import { historyTime, replayTime } from './timeline';

const NOW = Date.parse('2026-10-16T12:00:00Z');

const square = (w: number, s: number, e: number, n: number): GeoJSON.Polygon => ({ type: 'Polygon', coordinates: [[[w, s], [e, s], [e, n], [w, n], [w, s]]] });
const USA = parseBoundaries({ features: [{ type: 'Feature', geometry: square(-125, 24, -66, 49), properties: { id: 'USA', name: 'United States of America', iso3: 'USA', label: [-98, 39] } }] }, 'country');
const TEXAS = parseBoundaries({ features: [{ type: 'Feature', geometry: square(-106.6, 25.8, -93.5, 36.5), properties: { id: 'US-TX', name: 'Texas', countryId: 'USA', country: 'United States of America', label: [-99, 31] } }] }, 'admin1');

function fakeSite(get: (path: string) => unknown = () => null) {
  const calls = { flyTo: [] as number[][], highlight: [] as (Highlight | null)[], track: [] as unknown[], move: [] as unknown[], timeline: [] as unknown[], gets: [] as string[] };
  const data: Record<string, unknown> = {
    commercial_flights: [
      { icao24: 'aa0001', callsign: 'DAL12', lat: 40.6, lng: -73.8, alt: 10_700, speed_knots: 460, squawk: '1200', grounded: false, model: 'B763', registration: 'N171DN' },
      { icao24: 'aa0002', callsign: 'UAL9', lat: 31.9, lng: -97.9, alt: 900, speed_knots: 180, squawk: '7700', grounded: false },
    ],
    private_flights: [], private_jets: [], military_flights: [],
    weather_events: [{ id: 'w1', title: 'Flood Warning', lat: 30.3, lng: -97.7, type: 'Flood', severity: 'Severe', provider: 'NWS' }],
    news: [{ id: 'n1', title: 'Storms lash Austin', published: '2026-10-16T11:00:00Z', source_name: 'Wire' }],
    earthquakes: [],
  };
  const site: Site = {
    data: () => data,
    view: () => ({ lat: 31, lng: -98, zoom: 5, projection: 'globe', style: 'dark', bounds: { west: -110, south: 20, east: -85, north: 40 } }),
    layers: () => ({ flights: true, private: true, jets: true, weather: true, earthquakes: true }),
    flyTo: (lat, lng, zoom) => { calls.flyTo.push([lat, lng, zoom ?? -1]); },
    setLayers: () => {},
    highlight: h => { calls.highlight.push(h); },
    openPanel: () => {},
    setView: () => {},
    geocode: async q => (/texas/i.test(q) ? { name: 'Texas', lat: 31, lng: -99, kind: 'state' } : /austin/i.test(q) ? { name: 'Austin', lat: 30.27, lng: -97.74, kind: 'city' } : /dallas/i.test(q) ? { name: 'Dallas', lat: 32.78, lng: -96.8, kind: 'city' } : null),
    forecast: async () => ({ ok: true, id: 'run' }),
    get: async path => { calls.gets.push(path); return get(path); },
    post: async (url, form) => { calls.gets.push(`${url}?${form}`); return get(url); },
    regions: { countries: async () => USA, admin1: async () => TEXAS },
    memo: {},
    origin: 'https://takip.example',
    track: t => { calls.track.push(t); },
    tracked: () => null,
    untrack: () => {},
    move: v => { calls.move.push(v); return 'Camera: zoom 6.0'; },
    timeline: async t => { calls.timeline.push(t); return { ok: true, summary: 'Replay at …' }; },
    feeds: () => ({}),
  };
  return { site, calls, data };
}

afterEach(() => { vi.useRealTimers(); });

describe('one definition for both surfaces', () => {
  it('shows every TI tool in the prompt and builds MCP schemas from the same parameters', () => {
    const guide = toolGuide();
    for (const n of TOOL_NAMES) if (TOOL_DEFS[n].surfaces.includes('ti')) expect(guide).toContain(`\n${n} {`);
    expect(signature(TOOL_DEFS.route)).toBe('route {from: string | {lat, lng}, to: string | {lat, lng}, mode?: "drive"|"bike"|"walk", show?: boolean}');
    const names = MCP_DEFS.map(d => mcpTool(d).name);
    expect(names).toEqual(expect.arrayContaining(['takip_find', 'takip_weather', 'takip_nearby', 'show_in_takip']));
    for (const d of MCP_DEFS) {
      const t = mcpTool(d);
      expect(t.inputSchema.type).toBe('object');
      expect(JSON.parse(JSON.stringify(t))).toEqual(t);
    }
  });
});

describe('find, grown into an analyst query', () => {
  it('searches inside a named region on fields, outlines it, and narrows on a follow-up', async () => {
    const { site, calls } = fakeSite();
    const out = await runCall({ tool: 'find', args: { layer: 'flights', region: 'Texas', where: [{ field: 'squawk', op: 'eq', value: '7700' }] } }, site);
    expect(out.result.ok).toBe(true);
    expect(out.result.summary).toMatch(/^at least 1 of 2 flights in Texas, United States of America matched/);
    expect((out.result.data as { items: { id: string }[]; complete: boolean }).items[0].id).toBe('aa0002');
    expect(calls.highlight.at(-1)?.outlines?.[0].label).toBe('Texas, United States of America');
    const all = await runCall({ tool: 'find', args: { layer: 'flights' } }, site);
    expect((all.result.data as { items: unknown[] }).items).toHaveLength(2);
    const narrowed = await runCall({ tool: 'find', args: { layer: 'flights', follow_up: true, where: [{ field: 'altitude', op: 'gt', value: '30000 ft' }] } }, site);
    expect((narrowed.result.data as { items: { name: string }[] }).items.map(i => i.name)).toEqual(['DAL12']);
  });

  it('fetches fire perimeters itself, since the page keeps them out of its data', async () => {
    const { site, calls } = fakeSite(path => (path === '/api/fires/perimeters' ? { type: 'FeatureCollection', features: [
      { type: 'Feature', geometry: square(-120.6, 38.9, -120.4, 39.1), properties: { id: 'p1', name: 'Ridge Fire', acres: 12_400, contained: 35, state: 'CA', kind: 'wildfire', mapped: NOW } },
      { type: 'Feature', geometry: square(-111.2, 34.0, -111.0, 34.2), properties: { id: 'p2', name: 'Pine Rx', acres: 300, contained: 100, state: 'AZ', kind: 'prescribed' } },
    ] } : null));
    const out = await runCall({ tool: 'find', args: { layer: 'perimeters', where: [{ field: 'contained', op: 'lt', value: 100 }] } }, site);
    expect(out.result.ok).toBe(true);
    expect((out.result.data as { items: { name: string; detail: string; lat: number }[] }).items).toEqual([expect.objectContaining({ name: 'Ridge Fire', detail: '12,400 acres · 35% contained · CA', lat: 39 })]);
    await runCall({ tool: 'find', args: { layer: 'fire_perimeters' } }, site);
    expect(calls.gets.filter(g => g === '/api/fires/perimeters')).toHaveLength(1);
  });

  it('refuses a typo with the fields it knows, and a city as a region', async () => {
    const { site } = fakeSite();
    const typo = await runCall({ tool: 'find', args: { layer: 'flights', where: [{ field: 'altitud', op: 'gt', value: 1 }] } }, site);
    expect(typo.result).toMatchObject({ ok: false, summary: expect.stringMatching(/^UNKNOWN_FIELD/) });
    expect((typo.result.data as { allowed: string[] }).allowed).toContain('altitude');
    const city = await runCall({ tool: 'find', args: { layer: 'flights', region: 'Dallas' } }, site);
    expect(city.result.summary).toMatch(/^NO_REGION/);
  });
});

describe('following, moving, linking and the clocks', () => {
  it('tracks by callsign or the nearest airborne aircraft, and moves the camera', async () => {
    const { site, calls } = fakeSite();
    expect((await runCall({ tool: 'track', args: { text: 'ual 9' } }, site)).result.ok).toBe(true);
    expect(calls.track[0]).toEqual({ kind: 'aircraft', id: 'aa0002' });
    await runCall({ tool: 'track', args: { nearest_to: 'Dallas' } }, site);
    expect(calls.track[1]).toEqual({ kind: 'aircraft', id: 'aa0002' });
    expect((await runCall({ tool: 'track', args: { id: 'zzz' } }, site)).result.ok).toBe(false);
    const moved = await runCall({ tool: 'move', args: { zoom_by: 1, tilt: 60, orbit: true } }, site);
    expect(moved.result.ok).toBe(true);
    expect(calls.move[0]).toMatchObject({ zoomBy: 1, tilt: 60, orbit: 30 });
  });

  it('links the view or a place, with layers and a followed target', async () => {
    const { site } = fakeSite();
    const out = await runCall({ tool: 'link', args: { place: 'Austin', zoom: 9, layers: ['flights', 'nonsense'], track: 'aircraft:aa0002' } }, site);
    expect((out.result.data as { url: string }).url).toBe('https://takip.example/?lat=30.2700&lon=-97.7400&zoom=9.0&layers=flights&track=aircraft:aa0002');
    const here = await runCall({ tool: 'link', args: {} }, site);
    expect((here.result.data as { url: string }).url).toMatch(/lat=31\.0000&lon=-98\.0000&zoom=5\.0&layers=flights,private,jets,earthquakes,weather/);
  });

  it('reads times for Replay and years for History', async () => {
    expect(replayTime('2 hours ago', NOW)).toBe(NOW - 7_200_000);
    expect(replayTime('-90m', NOW)).toBe(NOW - 5_400_000);
    expect(replayTime('2026-10-15T08:00:00Z', NOW)).toBe(Date.parse('2026-10-15T08:00:00Z'));
    expect(new Date(historyTime('1914')!).getUTCFullYear()).toBe(1914);
    expect(new Date(historyTime('500 BC')!).getUTCFullYear()).toBe(-499);
    const { site, calls } = fakeSite();
    expect((await runCall({ tool: 'timeline', args: { mode: 'history', at: '1914', play: true } }, site)).result.ok).toBe(true);
    expect(calls.timeline[0]).toMatchObject({ mode: 'history', play: true });
    expect((await runCall({ tool: 'timeline', args: { mode: 'replay', at: 'next week' } }, site)).result.ok).toBe(false);
  });
});

describe('looking things up', () => {
  it('describes one aircraft from the registry, its route and its track', async () => {
    const { site, calls } = fakeSite(path => (path.startsWith('/api/aircraft')
      ? { icao24: 'aa0002', registration: 'N12345', typeCode: 'B738', model: 'BOEING 737-800', operator: 'United', track: [[-87.9, 41.9], [-95, 35]], points: 2, departure: { icao: 'KORD', iata: 'ORD', city: 'Chicago', lat: 41.97, lng: -87.9 }, arrival: null }
      : { found: true, origin: { icao: 'KORD', iata: 'ORD', city: 'Chicago', lat: 41.97, lng: -87.9 }, destination: { icao: 'KIAH', iata: 'IAH', city: 'Houston', lat: 29.98, lng: -95.34 } }));
    const out = await runCall({ tool: 'aircraft', args: { callsign: 'UAL9' } }, site);
    expect(out.result.ok).toBe(true);
    expect(out.result.data).toMatchObject({ icao24: 'aa0002', model: 'BOEING 737-800', operator: 'United', from: 'ORD Chicago', emergency: 'general emergency' });
    expect(calls.gets[0]).toBe('/api/aircraft?icao24=aa0002');
    expect(calls.highlight.at(-1)?.lines?.[0].kind).toBe('track');
  });

  it('gives the weather from the nearest METAR, the model and warnings near it', async () => {
    const { site } = fakeSite(path => (path.startsWith('/api/aviation-weather')
      ? { airports: [{ id: 'KAUS', lat: 30.19, lng: -97.67, cat: 'IFR', at: '2026-10-16T11:53:00Z', raw: 'KAUS 161153Z 18012KT 2SM RA OVC006 22/21', tempC: 22, windDir: 180, windKt: 12, visSm: '2', ceilingFt: 600, wx: 'RA' }] }
      : { current: { temperature_2m: 22.4, weather_code: 63, wind_speed_10m: 20, wind_direction_10m: 180, relative_humidity_2m: 95 }, hourly: { time: ['a', 'b'], temperature_2m: [22, 25], precipitation_probability: [80, 60], weather_code: [63, 3] }, elevation: 149 }));
    const out = await runCall({ tool: 'weather', args: { place: 'Austin' } }, site);
    expect(out.result.summary).toMatch(/^Austin: Rain, 22°C; KAUS \(11 km\) reports S 12 kt, IFR/);
    expect(out.result.data).toMatchObject({ place: { ground_m: 149 }, warnings: [{ title: 'Flood Warning' }] });
  });

  it('routes between places and draws the line', async () => {
    const { site, calls } = fakeSite(() => ({ distance: 315_000, duration: 11_400, geometry: { coordinates: [[-97.74, 30.27], [-96.8, 32.78]] }, steps: [{ instruction: 'Head north on I-35', distance: 300_000 }] }));
    const out = await runCall({ tool: 'route', args: { from: 'Austin', to: 'Dallas' } }, site);
    expect(out.result.summary).toBe('Austin to Dallas: 315 km, about 3 h 10 min to drive');
    expect(calls.gets[0]).toBe('/api/v1/directions?from=30.27,-97.74&to=32.78,-96.8&mode=auto');
    expect(calls.highlight.at(-1)?.lines?.[0].kind).toBe('route');
  });

  it('asks OpenStreetMap for mapped features nearest first', async () => {
    const { site, calls } = fakeSite(() => ({ elements: [
      { type: 'way', id: 2, center: { lat: 30.4, lon: -97.7 }, tags: { name: 'Far Base', military: 'base' } },
      { type: 'node', id: 1, lat: 30.28, lon: -97.74, tags: { name: 'Camp Mabry', military: 'barracks' } },
    ] }));
    const out = await runCall({ tool: 'nearby', args: { near: 'Austin', kind: 'military' } }, site);
    expect((out.result.data as { items: { name: string }[] }).items.map(i => i.name)).toEqual(['Camp Mabry', 'Far Base']);
    expect(decodeURIComponent(calls.gets[0])).toContain('nwr["landuse"="military"](around:15000,30.27000,-97.74000)');
    expect((await runCall({ tool: 'nearby', args: { near: 'Austin', kind: 'embassies' } }, site)).result.ok).toBe(true);
    expect((await runCall({ tool: 'nearby', args: { near: 'Austin', kind: 'castles' } }, site)).result.ok).toBe(false);
  });

  it('briefs a place from what is loaded and the country dossier', async () => {
    const { site } = fakeSite(() => ({ location: { country: 'United States' }, travel_advice: [{ issuer: 'UK FCDO', level: 0, label: 'No warnings' }], wikipedia: { extract: 'Austin is the capital of Texas.' } }));
    const out = await runCall({ tool: 'brief', args: { place: 'Austin', radius_km: 200 } }, site);
    expect(out.result.ok).toBe(true);
    expect(out.result.data).toMatchObject({ country: 'United States', hazards: [{ layer: 'weather', count: 1 }], headlines: [{ name: 'Storms lash Austin' }] });
  });

  it('works out satellite passes from the loaded element sets', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(Date.parse('2024-01-01T12:00:00Z'));
    const { site, data } = fakeSite();
    data.satellites = [{ name: 'ISS (ZARYA)', noradId: '25544', lat: 0, lng: 0,
      line1: '1 25544U 98067A   24001.50000000  .00016717  00000-0  10270-3 0  9000',
      line2: '2 25544  51.6416 247.4627 0006703 130.5360 325.0288 15.50377579999990' }];
    const out = await runCall({ tool: 'pass', args: { near: { lat: 51.5, lng: -0.1 }, hours: 24 } }, site);
    expect(out.result.ok).toBe(true);
    const passes = (out.result.data as { passes: { max_elevation: number; rise_utc: string }[] }).passes;
    expect(passes.length).toBeGreaterThan(0);
    expect(passes[0].max_elevation).toBeGreaterThanOrEqual(10);
    const up = await runCall({ tool: 'pass', args: { near: { lat: 51.5, lng: -0.1 }, overhead: true, min_elevation: 0 } }, site);
    expect(up.result.ok).toBe(true);
  });
});
