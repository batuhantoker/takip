import { afterEach, describe, it, expect, vi } from 'vitest';
import {
  extractWebcams, decodeEntities, mapInfoclimatWebcam, fetchInfoclimatCameras, type InfoclimatWebcam,
} from './infoclimat';

afterEach(() => vi.unstubAllGlobals());

// Trimmed from www.infoclimat.fr/annuaire-webcams-meteo.html (2026-10-12): six of the 224 webcams.
const PAGE = `<script>
        var hash = document.location.hash.split('#')[1];
        var json_webcams = [{"lat":45.23635,"lon":4.7621,"id":"593","libelle":"<b>Thorrenc<\\/b><br>Derni\\u00e8re image : lundi 12 octobre 2026 \\u00e0 20h45","style":"active","link":"\\/cartes\\/getProxyWebcam.php?idw=593&c=30&t=jpg"},{"lat":47.8,"lon":11,"id":"319","libelle":"<b>Hohenpei&szlig;enberg<\\/b><br>Derni\\u00e8re image : lundi 12 octobre 2026 \\u00e0 20h45","style":"active","link":"\\/cartes\\/getProxyWebcam.php?idw=319&c=30&t=jpg"},{"lat":50.35,"lon":4.25,"id":"283","libelle":"<b>Lobbes<\\/b><br>Derni\\u00e8re image : jeudi 8 octobre 2026 \\u00e0 13h40","style":"inactive","link":"\\/cartes\\/getProxyWebcam.php?idw=283&c=30&t=jpg"},{"lat":45.773815,"lon":5.873576,"id":"495","libelle":"<b>Belv&eacute;d&egrave;re de la Chambotte<\\/b><br>Derni\\u00e8re image : lundi 12 octobre 2026 \\u00e0 20h40","style":"active","link":"\\/cartes\\/getProxyWebcam.php?idw=495&c=30&t=jpg"},{"lat":-21.3303,"lon":55.5673,"id":"657","libelle":"<b>Petite-&Icirc;le - Charri&eacute;<\\/b><br>Derni\\u00e8re image : lundi 12 octobre 2026 \\u00e0 20h45","style":"active","link":"\\/cartes\\/getProxyWebcam.php?idw=657&c=30&t=jpg"},{"lat":-20.8841,"lon":55.4339,"id":"772","libelle":"<b>Saint-Denis - La Montagne<\\/b><br>Derni\\u00e8re image : lundi 12 octobre 2026 \\u00e0 20h45","style":"active","link":"\\/cartes\\/getProxyWebcam.php?idw=772&c=30&t=jpg"}];

        function initialize() {`;

const WEBCAMS = extractWebcams(PAGE)!;
const byId = (id: string) => WEBCAMS.find(w => w.id === id)!;

describe('extractWebcams', () => {
  it('reads the embedded webcam list', () => {
    expect(WEBCAMS.map(w => w.id)).toEqual(['593', '319', '283', '495', '657', '772']);
  });

  it('returns null without the list or on a broken one', () => {
    expect(extractWebcams('<html></html>')).toBeNull();
    expect(extractWebcams('var json_webcams = [{"id":}];')).toBeNull();
    expect(extractWebcams('var json_webcams = {};')).toBeNull();
  });
});

describe('decodeEntities', () => {
  it('decodes the Latin-1 named entities Infoclimat uses', () => {
    expect(decodeEntities('Belv&eacute;d&egrave;re')).toBe('Belvédère');
    expect(decodeEntities('Petite-&Icirc;le')).toBe('Petite-Île');
    expect(decodeEntities('Hohenpei&szlig;enberg')).toBe('Hohenpeißenberg');
    expect(decodeEntities('Saint-Laurent-de-Neste &amp; &#39;x&#39; &unknown;')).toBe("Saint-Laurent-de-Neste & 'x' &unknown;");
  });
});

describe('mapInfoclimatWebcam', () => {
  it('maps a webcam to its relayed still', () => {
    expect(mapInfoclimatWebcam(byId('593'))).toEqual({
      id: 'infoclimat-593',
      lat: 45.23635,
      lng: 4.7621,
      name: 'Thorrenc',
      city: '',
      country: '',
      feed_url: 'https://www.infoclimat.fr/cartes/getProxyWebcam.php?idw=593&c=30&t=jpg',
      external_url: 'https://www.infoclimat.fr/annuaire-webcams-meteo.html#593',
      source: 'Infoclimat',
    });
  });

  it('decodes names and keeps La Réunion', () => {
    expect(mapInfoclimatWebcam(byId('495'))?.name).toBe('Belvédère de la Chambotte');
    expect(mapInfoclimatWebcam(byId('657'))).toMatchObject({ name: 'Petite-Île - Charrié', lat: -21.3303, lng: 55.5673 });
  });

  it('drops webcams marked inactive', () => {
    expect(mapInfoclimatWebcam(byId('283'))).toBeNull();
  });

  it('drops unsafe ids and unusable coordinates', () => {
    const base: InfoclimatWebcam = byId('593');
    expect(mapInfoclimatWebcam({ ...base, id: '593&c=0' })).toBeNull();
    expect(mapInfoclimatWebcam({ ...base, id: null })).toBeNull();
    expect(mapInfoclimatWebcam({ ...base, lat: null })).toBeNull();
    expect(mapInfoclimatWebcam({ ...base, lat: 0, lon: 0 })).toBeNull();
    expect(mapInfoclimatWebcam({ ...base, lat: 60.1 })).toBeNull();
  });

  it('falls back to a generic name', () => {
    expect(mapInfoclimatWebcam({ ...byId('593'), libelle: null })?.name).toBe('Infoclimat webcam 593');
  });
});

describe('fetchInfoclimatCameras', () => {
  it('fetches the map page and keeps the active webcams', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(PAGE, { status: 200 })));
    expect((await fetchInfoclimatCameras()).map(c => c.id)).toEqual([
      'infoclimat-593', 'infoclimat-319', 'infoclimat-495', 'infoclimat-657', 'infoclimat-772',
    ]);
  });

  it('throws on an HTTP error or a page without the list', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 403 })));
    await expect(fetchInfoclimatCameras()).rejects.toThrow(/HTTP 403/);
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<html></html>', { status: 200 })));
    await expect(fetchInfoclimatCameras()).rejects.toThrow(/no json_webcams/);
  });
});

// Live integration test — opt in with RUN_LIVE_TESTS=1.
const liveIt = process.env.RUN_LIVE_TESTS === '1' ? it : it.skip;

describe('fetchInfoclimatCameras (live)', () => {
  liveIt('fetches the active webcams', async () => {
    const cams = await fetchInfoclimatCameras();
    expect(cams.length).toBeGreaterThan(150);
    expect(new Set(cams.map(c => c.id)).size).toBe(cams.length);
    for (const c of cams) expect(c.feed_url).toMatch(/^https:\/\/www\.infoclimat\.fr\/cartes\/getProxyWebcam\.php\?idw=\d+&c=30&t=jpg$/);
  }, 20000);
});
