import { describe, it, expect } from 'vitest';
import {
  parseKahramanmarasPortal,
  fetchKahramanmarasCameras,
  KAHRAMANMARAS_BOUNDS,
  KAHRAMANMARAS_PLACES,
} from './kahramanmaras';

// Verbatim from https://kamera.kahramanmaras.bel.tr/ (two of its cards).
const PORTAL = `
                            <div class="camera-card">

                    <div class="thumb-wrapper clickable-thumb"
                         data-stream="https://camstream.kahramanmaras.bel.tr/live/kale.stream/playlist.m3u8"
                         data-title="Kale"
                         data-category="Merkez Kameralar">

                        <img class="live-thumb-img" src="assets/images/placeholder.jpg" alt="Kale">
                        <div class="play-overlay">
                            <span class="play-icon">▶</span>
                        </div>
                        <video class="snap-video" style="display:none;" muted playsinline></video>
                        <canvas class="snap-canvas" style="display:none;"></canvas>

                    </div>
                    <div class="card-body">
                        <span class="category">Merkez Kameralar</span>
                        <h3>Kale</h3>
                    </div>
                </div>
                            <div class="camera-card">

                    <div class="thumb-wrapper clickable-thumb"
                         data-stream="https://camstream.kahramanmaras.bel.tr/live/elbistan-meydan.stream/playlist.m3u8"
                         data-title="Elbistan Meydan"
                         data-category="İlçe Kameraları">

                        <img class="live-thumb-img" src="assets/images/placeholder.jpg" alt="Elbistan Meydan">
`;

const card = (slug: string, title: string, host = 'camstream.kahramanmaras.bel.tr') =>
  `<div class="thumb-wrapper clickable-thumb" data-stream="https://${host}/live/${slug}.stream/playlist.m3u8" data-title="${title}" data-category="Merkez Kameralar">`;

describe('parseKahramanmarasPortal', () => {
  it('maps each card to its HLS stream at its geocoded place', () => {
    expect(parseKahramanmarasPortal(PORTAL)).toEqual([
      {
        id: 'tr-kahramanmaras-kale',
        lat: 37.58718,
        lng: 36.92539,
        name: 'Kale',
        city: 'Kahramanmaraş',
        country: 'Turkey',
        stream_url: 'https://camstream.kahramanmaras.bel.tr/live/kale.stream/playlist.m3u8',
        stream_type: 'hls',
        external_url: 'https://kamera.kahramanmaras.bel.tr/',
        source: 'Kahramanmaraş Büyükşehir Belediyesi',
      },
      expect.objectContaining({ id: 'tr-kahramanmaras-elbistan-meydan', city: 'Elbistan', lat: 38.20223, lng: 37.1903 }),
    ]);
  });

  it('puts unplaced cameras at the city centre and names the two terraces apart', () => {
    const cams = parseKahramanmarasPortal(card('terasdogu', 'Teras') + card('terasbati', 'Teras') + card('yeni-kamera', 'Yeni'));
    expect(cams.map(c => c.name)).toEqual(['Teras Doğu', 'Teras Batı', 'Yeni']);
    for (const c of cams) expect([c.lat, c.lng, c.city]).toEqual([37.58127, 36.92751, 'Kahramanmaraş']);
  });

  it('drops streams off the operator host, non-playlist URLs and duplicates', () => {
    const cams = parseKahramanmarasPortal([
      card('kale', 'Kale', 'example.com'),
      '<div data-stream="http://camstream.kahramanmaras.bel.tr/live/kale.stream/playlist.m3u8" data-title="Kale">',
      '<div data-stream="https://camstream.kahramanmaras.bel.tr/live/kale.stream/chunklist.m3u8" data-title="Kale">',
      card('ulucami', 'Ulu Camii ve Meydan'),
      card('ulucami', 'Ulu Camii ve Meydan'),
    ].join('\n'));
    expect(cams.map(c => c.id)).toEqual(['tr-kahramanmaras-ulucami']);
  });

  it('decodes entities and falls back to a default name', () => {
    expect(parseKahramanmarasPortal(card('kale', 'Kale &amp; Sur'))[0].name).toBe('Kale & Sur');
    expect(parseKahramanmarasPortal(card('kale', ' '))[0].name).toBe('Kahramanmaraş Camera kale');
  });

  it('keeps every geocoded place inside the bounds', () => {
    const b = KAHRAMANMARAS_BOUNDS;
    for (const [lat, lng] of Object.values(KAHRAMANMARAS_PLACES)) {
      expect(lat > b.minLat && lat < b.maxLat && lng > b.minLng && lng < b.maxLng).toBe(true);
    }
  });

  it('finds nothing in a page without cards', () => {
    expect(parseKahramanmarasPortal('<html><body>Bakım çalışması</body></html>')).toEqual([]);
  });
});

// Live integration test — opt in with RUN_LIVE_TESTS=1.
const liveIt = process.env.RUN_LIVE_TESTS === '1' ? it : it.skip;

describe('fetchKahramanmarasCameras (live)', () => {
  liveIt('fetches the portal cameras', async () => {
    const cams = await fetchKahramanmarasCameras();
    expect(cams.length).toBeGreaterThan(15);
    expect(new Set(cams.map(c => c.id)).size).toBe(cams.length);
    for (const c of cams) {
      expect(c.id).toMatch(/^tr-kahramanmaras-[a-z0-9-]+$/);
      expect(c.stream_url).toMatch(/^https:\/\/camstream\.kahramanmaras\.bel\.tr\/live\/[a-z0-9-]+\.stream\/playlist\.m3u8$/);
    }
  }, 20_000);
});
