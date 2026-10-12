import { afterEach, describe, it, expect, vi } from 'vitest';
import { parseMarkers, parsePlaces, mapIdokepMarker, fetchIdokepCameras } from './idokep';

afterEach(() => vi.unstubAllGlobals());

// Trimmed from www.idokep.hu/webkamera (2026-10-12): three of the 627 map markers.
const MAP_PAGE = `<script>
new L.marker([47.5027, 19.04], { icon: L.divIcon({html: '<img class="t" src="/images/blackthumbnail.jpg" datasrc="//cam.idokep.hu/cam/hotelvictoria/thumbnail.jpg" alt="hotelvictoria"><img src="/images/irany.png" class="i r45">',className: 'wico',iconSize: [52, 52]}),zIndexOffset:154}).addTo(map);
new L.marker([48.0711, 19.2736], { icon: L.divIcon({html: '<img class="t" src="/images/blackthumbnail.jpg" datasrc="//cam.idokep.hu/cam/hanzo2/thumbnail.jpg" alt="hanzo2"><img src="/images/irany.png" class="i r135">',className: 'wico',iconSize: [52, 52]}),zIndexOffset:-1}).addTo(map);
new L.marker([46.913, 18.0577], { icon: L.divIcon({html: '<img class="t" src="/images/blackthumbnail.jpg" datasrc="//cam.idokep.hu/cam/hotellidosiofok/thumbnail.jpg" alt="hotellidosiofok"><img src="/images/irany.png" class="i r315">',className: 'wico',iconSize: [52, 52]}),zIndexOffset:20}).addTo(map);
</script>`;

// Trimmed from www.idokep.hu/webkamera/mindegyik (2026-10-12): two of the 633 cards.
const LIST_PAGE = `
                    <div class="col-6 col-lg-3 position-relative">
                      <div class="ik kamera-ajanlo">
                        <a href="/webkamera/hotelvictoria" user="hotelvictoria">
                          <div class="ik kamera-ajanlo-container">
                            <div class="ik hover-overlay"></div>
                            <div class="ik kamera-caption">
                              <span>Budapest - Parlament</span>
                            </div>
                            <div class="ik kamera-kep"><img src="//cam.idokep.hu/hotelvictoria/thumbnail.jpg" loading="lazy" id="ikhotelvictoria" alt="hotelvictoria-Budapest - Parlament webkamera">
                            </div>
                          </div>
                        </a>
                      </div>
                    </div>

                    <div class="col-6 col-lg-3 position-relative">
                      <div class="ik kamera-ajanlo">
                        <a href="/webkamera/hanzo2" user="hanzo2">
                          <div class="ik kamera-ajanlo-container">
                            <div class="ik hover-overlay"></div>
                            <div class="ik kamera-caption">
                              <span>Balassagyarmat</span>
                            </div>
                            <div class="ik kamera-kep"><img src="//cam.idokep.hu/hanzo2/thumbnail.jpg" loading="lazy" id="ikhanzo2" alt="hanzo2-Balassagyarmat webkamera">
                            </div>
                          </div>
                        </a>
                      </div>
                    </div>
`;

const MARKERS = parseMarkers(MAP_PAGE);
const PLACES = parsePlaces(LIST_PAGE);

describe('parseMarkers / parsePlaces', () => {
  it('reads each map marker and listing caption', () => {
    expect(MARKERS).toEqual([
      { user: 'hotelvictoria', lat: 47.5027, lng: 19.04 },
      { user: 'hanzo2', lat: 48.0711, lng: 19.2736 },
      { user: 'hotellidosiofok', lat: 46.913, lng: 18.0577 },
    ]);
    expect([...PLACES]).toEqual([['hotelvictoria', 'Budapest - Parlament'], ['hanzo2', 'Balassagyarmat']]);
  });

  it('finds nothing on an unrelated page', () => {
    expect(parseMarkers('<html></html>')).toEqual([]);
    expect(parsePlaces('<html></html>').size).toBe(0);
  });
});

describe('mapIdokepMarker', () => {
  it('maps a marker to its map thumbnail', () => {
    expect(mapIdokepMarker(MARKERS[0], PLACES.get('hotelvictoria'))).toEqual({
      id: 'idokep-hotelvictoria',
      lat: 47.5027,
      lng: 19.04,
      name: 'Budapest - Parlament',
      city: 'Budapest - Parlament',
      country: '',
      feed_url: 'https://cam.idokep.hu/cam/hotelvictoria/thumbnail.jpg',
      external_url: 'https://www.idokep.hu/webkamera/hotelvictoria',
      source: 'Időkép',
    });
  });

  it('falls back to the member handle without a caption', () => {
    expect(mapIdokepMarker(MARKERS[2], PLACES.get('hotellidosiofok'))).toMatchObject({
      id: 'idokep-hotellidosiofok', name: 'hotellidosiofok', city: '',
    });
  });

  it('drops unsafe handles and unusable coordinates', () => {
    const m = MARKERS[1];
    expect(mapIdokepMarker({ ...m, user: '..' })).toBeNull();
    expect(mapIdokepMarker({ ...m, user: 'a/b' })).toBeNull();
    expect(mapIdokepMarker({ ...m, lat: NaN })).toBeNull();
    expect(mapIdokepMarker({ ...m, lat: 0, lng: 0 })).toBeNull();
    expect(mapIdokepMarker({ ...m, lat: 60 })).toBeNull();
  });
});

describe('fetchIdokepCameras', () => {
  it('joins the map markers with the listing captions', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) =>
      new Response(url.endsWith('/mindegyik') ? LIST_PAGE : MAP_PAGE + MAP_PAGE, { status: 200 })));
    const cams = await fetchIdokepCameras();
    expect(cams.map(c => [c.id, c.name])).toEqual([
      ['idokep-hotelvictoria', 'Budapest - Parlament'],
      ['idokep-hanzo2', 'Balassagyarmat'],
      ['idokep-hotellidosiofok', 'hotellidosiofok'],
    ]);
  });

  it('throws on an HTTP error or a map without markers', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 503 })));
    await expect(fetchIdokepCameras()).rejects.toThrow(/HTTP 503/);
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<html></html>', { status: 200 })));
    await expect(fetchIdokepCameras()).rejects.toThrow(/no markers/);
  });
});

// Live integration test — opt in with RUN_LIVE_TESTS=1.
const liveIt = process.env.RUN_LIVE_TESTS === '1' ? it : it.skip;

describe('fetchIdokepCameras (live)', () => {
  liveIt('fetches the webcam map', async () => {
    const cams = await fetchIdokepCameras();
    expect(cams.length).toBeGreaterThan(400);
    expect(new Set(cams.map(c => c.id)).size).toBe(cams.length);
    expect(cams.filter(c => c.city).length).toBeGreaterThan(cams.length * 0.9);
    for (const c of cams) expect(c.feed_url).toMatch(/^https:\/\/cam\.idokep\.hu\/cam\/[\w.-]+\/thumbnail\.jpg$/);
  }, 20000);
});
