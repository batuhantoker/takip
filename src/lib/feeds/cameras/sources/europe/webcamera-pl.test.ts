import { afterEach, describe, it, expect, vi } from 'vitest';
import { extractMarkers, mapWebcameraPlMarker, fetchWebcameraPlCameras, type WebcameraPlMarker } from './webcamera-pl';

afterEach(() => vi.unstubAllGlobals());

// Trimmed from www.webcamera.pl/mapa (2026-10-12): three of the 439 markers, the rest of the script verbatim.
const PAGE = `<script>
var MAP_MARKERS = {"krupowkidolne":{"cam":"krupowkidolne","tags":["krup\\u00f3wki","dolne","zakopane","tatry","deptak","narty","warunki","narciarskie","podhale"],"url":"https:\\/\\/krupowkidolne.webcamera.pl\\/","name":"Krup\\u00f3wki Dolne - widok na deptak","is_new":false,"is_inactive":false,"img_alt":"Kamera Zakopane na \\u017cywo widok na deptak","img_title":"Widok na sklepy, doro\\u017cki, turyst\\u00f3w na deptaku Krup\\u00f3wki w Zakopanem - ogl\\u0105daj","lat":"49.29431013417802","lng":"19.952875139881137"},"sucheski2":{"cam":"sucheski2","tags":["suche","narty","krzes\\u0142o","wypoczynek","g\\u00f3ry","stok","poronin","ski"],"url":"https:\\/\\/sucheski2.webcamera.pl\\/","name":"Ski Suche - widok z g\\u00f3rnej stacji","is_new":false,"is_inactive":true,"img_alt":"Ski Suche - widok z g\\u00f3rnej stacji o\\u015brodka narciarskiego","img_title":"Kamera z widokiem na kolej linow\\u0105 w SKI SUCHE","lat":"49.32988568299894","lng":"19.982505733343487"},"krakow1":{"cam":"krakow1","tags":["krak\\u00f3w","miasto","grodzka","\\u015bdm","Cracow"],"url":"https:\\/\\/www.webcamera.pl\\/kamera\\/krakow1\\/","name":"Krak\\u00f3w - widok na Rynek G\\u0142\\u00f3wny","is_new":false,"is_inactive":false,"img_alt":"Kamera z widokiem na Rynek G\\u0142\\u00f3wny","img_title":"KRAK\\u00d3W - widok na Rynek G\\u0142\\u00f3wny - Nowe uj\\u0119cie","lat":"50.06281916827564","lng":"19.936744272708893"}};
var MAP_ZOOM_IN = 'przybliż na mapie';
</script>`;

const MARKERS = extractMarkers(PAGE)!;
const [krupowki, sucheski, krakow] = MARKERS;

describe('extractMarkers', () => {
  it('reads the embedded marker object', () => {
    expect(MARKERS.map(m => m.cam)).toEqual(['krupowkidolne', 'sucheski2', 'krakow1']);
    expect(krupowki.name).toBe('Krupówki Dolne - widok na deptak');
  });

  it('returns null without the markers or on a broken object', () => {
    expect(extractMarkers('<html></html>')).toBeNull();
    expect(extractMarkers('var MAP_MARKERS = {"a":}')).toBeNull();
    expect(extractMarkers('var MAP_MARKERS = [];')).toBeNull();
  });
});

describe('mapWebcameraPlMarker', () => {
  it('maps a marker to the 1080p still behind its card', () => {
    expect(mapWebcameraPlMarker(krupowki)).toEqual({
      id: 'webcamerapl-krupowkidolne',
      lat: 49.29431013417802,
      lng: 19.952875139881137,
      name: 'Krupówki Dolne - widok na deptak',
      city: '',
      country: 'Poland',
      feed_url: 'https://imageserver.webcamera.pl/miniaturki/krupowkidolne.jpg',
      external_url: 'https://krupowkidolne.webcamera.pl/',
      source: 'webcamera.pl',
    });
  });

  it('keeps a camera page on the main domain', () => {
    expect(mapWebcameraPlMarker(krakow)?.external_url).toBe('https://www.webcamera.pl/kamera/krakow1/');
  });

  it('drops inactive cameras', () => {
    expect(mapWebcameraPlMarker(sucheski)).toBeNull();
  });

  it('drops unsafe slugs and unusable coordinates', () => {
    const base: WebcameraPlMarker = krupowki;
    expect(mapWebcameraPlMarker({ ...base, cam: '../krupowkidolne' })).toBeNull();
    expect(mapWebcameraPlMarker({ ...base, cam: null })).toBeNull();
    expect(mapWebcameraPlMarker({ ...base, lat: null })).toBeNull();
    expect(mapWebcameraPlMarker({ ...base, lat: '' })).toBeNull();
    expect(mapWebcameraPlMarker({ ...base, lat: '0', lng: '0' })).toBeNull();
    expect(mapWebcameraPlMarker({ ...base, lat: '41.9', lng: '12.5' })).toBeNull();
  });

  it('falls back to the camera subdomain for a foreign page link', () => {
    expect(mapWebcameraPlMarker({ ...krupowki, url: 'https://example.com/' })?.external_url)
      .toBe('https://krupowkidolne.webcamera.pl/');
  });
});

describe('fetchWebcameraPlCameras', () => {
  it('fetches the map page and keeps the active markers', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(PAGE, { status: 200 })));
    expect((await fetchWebcameraPlCameras()).map(c => c.id)).toEqual(['webcamerapl-krupowkidolne', 'webcamerapl-krakow1']);
  });

  it('throws on an HTTP error or a page without markers', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 503 })));
    await expect(fetchWebcameraPlCameras()).rejects.toThrow(/HTTP 503/);
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<html></html>', { status: 200 })));
    await expect(fetchWebcameraPlCameras()).rejects.toThrow(/no MAP_MARKERS/);
  });
});

// Live integration test — opt in with RUN_LIVE_TESTS=1.
const liveIt = process.env.RUN_LIVE_TESTS === '1' ? it : it.skip;

describe('fetchWebcameraPlCameras (live)', () => {
  liveIt('fetches the active Polish cameras', async () => {
    const cams = await fetchWebcameraPlCameras();
    expect(cams.length).toBeGreaterThan(300);
    expect(new Set(cams.map(c => c.id)).size).toBe(cams.length);
    for (const c of cams) expect(c.feed_url).toMatch(/^https:\/\/imageserver\.webcamera\.pl\/miniaturki\/[a-z0-9-]+\.jpg$/);
  }, 20000);
});
