import { afterEach, describe, it, expect, vi } from 'vitest';
import { mapSiataCamera, fetchSiataCameras, SIATA_BOUNDS, type SiataFeature } from './siata';

afterEach(() => vi.unstubAllGlobals());

// Trimmed features from geoportal.siata.gov.co/fastgeoapi/cameras/ (2026-10-12).
const caracoli: SiataFeature = {"type": "Feature", "geometry": {"type": "Point", "coordinates": [-75.6314, 6.2771]}, "properties": {"url": "https://siata.gov.co/ultimasFotosCamaras/ultimacam_nivel_caracoli_la_honda.jpg", "codigo": "101054", "tipo": "Nivel", "tipo_key": "nivel", "nombre": "Camara Nivel Caracoli La Honda", "short_name": "Medellin_camara_101054"}} as SiataFeature;
const oriente: SiataFeature = {"type": "Feature", "geometry": {"type": "Point", "coordinates": [-75.58864, 6.25922]}, "properties": {"url": "https://siata.gov.co/ultimasFotosCamaras/ultimacam_81_TORRESIATA_oriente.jpg", "codigo": "100018", "tipo": "Cielo", "tipo_key": "cielo", "nombre": "MedellinOrienteCCTV", "short_name": "SIATAOriente"}} as SiataFeature;
// The same still as 100018, listed again under a newer code.
const orienteAgain: SiataFeature = {"type": "Feature", "geometry": {"type": "Point", "coordinates": [-75.58864, 6.259215]}, "properties": {"url": "https://siata.gov.co/ultimasFotosCamaras/ultimacam_81_TORRESIATA_oriente.jpg", "codigo": "100402", "tipo": "Cielo", "tipo_key": "cielo", "nombre": "CamaraOrienteTorreSIATA", "short_name": ""}} as SiataFeature;
const capaLimite: SiataFeature = {"type": "Feature", "geometry": {"type": "Point", "coordinates": [-75.64516, 6.1608]}, "properties": {"url": "https://siata.gov.co/ultimasFotosCamaras/ultimacam_capa_limite_la_estrella.jpg", "codigo": "100193", "tipo": "Capa límite", "tipo_key": "capa_limite", "nombre": "CamaraCapaLimiteLaEstrella", "short_name": "CAPALIMITELaEstrella"}} as SiataFeature;

describe('mapSiataCamera', () => {
  it('maps a feature to its latest still', () => {
    expect(mapSiataCamera(caracoli)).toEqual({
      id: 'siata-101054',
      lat: 6.2771,
      lng: -75.6314,
      name: 'Camara Nivel Caracoli La Honda',
      city: 'Valle de Aburrá',
      country: 'Colombia',
      feed_url: 'https://siata.gov.co/ultimasFotosCamaras/ultimacam_nivel_caracoli_la_honda.jpg',
      external_url: 'https://geoportal.siata.gov.co/',
      source: 'SIATA',
    });
  });

  it('spaces out run-together names', () => {
    expect(mapSiataCamera(oriente)?.name).toBe('Medellin Oriente');
    expect(mapSiataCamera(capaLimite)?.name).toBe('Camara Capa Limite La Estrella');
    expect(mapSiataCamera({ ...caracoli, properties: { ...caracoli.properties, nombre: 'Camara Deprimido Los Musicos CCTV_2' } })?.name)
      .toBe('Camara Deprimido Los Musicos 2');
    expect(mapSiataCamera({ ...caracoli, properties: { ...caracoli.properties, nombre: '' } })?.name).toBe('SIATA Nivel 101054');
  });

  it('drops stills off siata.gov.co or over http', () => {
    const at = (url: string) => mapSiataCamera({ ...caracoli, properties: { ...caracoli.properties, url } });
    expect(at('http://siata.gov.co/ultimasFotosCamaras/ultimacam_nivel_caracoli_la_honda.jpg')).toBeNull();
    expect(at('https://example.com/ultimasFotosCamaras/x.jpg')).toBeNull();
    expect(at('https://siata.gov.co/ultimasFotosCamaras/../x.jpg')).toBeNull();
    expect(mapSiataCamera({ ...caracoli, properties: { ...caracoli.properties, codigo: null } })).toBeNull();
  });

  it('drops unusable coordinates', () => {
    expect(mapSiataCamera({ ...caracoli, geometry: { coordinates: [0, 0] } })).toBeNull();
    expect(mapSiataCamera({ ...caracoli, geometry: null })).toBeNull();
    expect(mapSiataCamera({ ...caracoli, geometry: { coordinates: [-74.0721, 4.711] } })).toBeNull();
    expect(mapSiataCamera(null)).toBeNull();
  });
});

describe('fetchSiataCameras', () => {
  it('maps the layer and keeps one camera per still', async () => {
    const body = { type: 'FeatureCollection', features: [oriente, caracoli, orienteAgain, caracoli] };
    vi.stubGlobal('fetch', vi.fn(async () => Response.json(body)));
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const cams = await fetchSiataCameras();
    expect(cams.map(c => c.id)).toEqual(['siata-100018', 'siata-101054']);
  });

  it('throws on an HTTP error or an unexpected body', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 502 })));
    await expect(fetchSiataCameras()).rejects.toThrow('HTTP 502');
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ detail: 'Not Found' })));
    await expect(fetchSiataCameras()).rejects.toThrow('unexpected response');
  });
});

// Live integration test — opt in with RUN_LIVE_TESTS=1.
const liveIt = process.env.RUN_LIVE_TESTS === '1' ? it : it.skip;

describe('fetchSiataCameras (live)', () => {
  liveIt('fetches the SIATA cameras', async () => {
    const cams = await fetchSiataCameras();
    expect(cams.length).toBeGreaterThan(60);
    const b = SIATA_BOUNDS;
    for (const c of cams) {
      expect(c.lat >= b.minLat && c.lat <= b.maxLat && c.lng >= b.minLng && c.lng <= b.maxLng).toBe(true);
      expect(c.feed_url).toMatch(/^https:\/\/siata\.gov\.co\/ultimasFotosCamaras\//);
    }
  }, 20_000);
});
