import { describe, it, expect } from 'vitest';
import { parseUludagWebcamPage, mapUludagWebcam, fetchUludagCameras, ULUDAG_BOUNDS } from './uludag';

// Verbatim from https://www.uludaginfo.com/tr/webcam: three of the fifteen camera objects in the flight-data chunk.
const BECEREN = String.raw`{\"id\":\"cmqfk8fdw00pqyxldqlinvxzn\",\"slug\":\"uludag-beceren-pisti\",\"streamUrl\":\"https://live.dgn.net.tr/uludag/pkdwDihF.m3u8\",\"streamTokenUrl\":\"/v2/webcams/uludag-beceren-pisti/stream-token\",\"streamOnline\":false,\"streamCheckedAt\":\"2026-10-12T17:30:00.124Z\",\"snapshotUrl\":\"https://live.dgn.net.tr/uludag/pkdwDihF.jpg\",\"bodyContent\":\"$24\",\"seoTitle\":\"Beceren Pisti Canlı Kamera | Uludağ Webcam\",\"seoDescription\":\"Uludağ Beceren pistinin canlı webcam görüntüsü. Kayak sezonu boyunca kar durumunu, pist doluluk oranını ve hava koşullarını anlık takip edin.\",\"altitude\":null,\"latitude\":null,\"longitude\":null,\"name\":\"Beceren Pisti Kamerası\",\"description\":\"Beceren Pisti kamerası, Uludağ 1. bölgesindeki başlangıç ve orta seviye pistleri canlı takip etmenizi sağlar; pist trafiği ve kar kalitesi anında görüntülenebilir.\"}`;
const KIRKGOZLER = String.raw`{\"id\":\"cmqfk8fev00quyxldbqymmsxh\",\"slug\":\"uludag-kirkgozler\",\"streamUrl\":\"https://live.dgn.net.tr/uludag/lt6t8m09g0.m3u8\",\"streamTokenUrl\":\"/v2/webcams/uludag-kirkgozler/stream-token\",\"streamOnline\":false,\"streamCheckedAt\":\"2026-10-12T17:30:00.124Z\",\"snapshotUrl\":\"https://live.dgn.net.tr/uludag/lt6t8m09g0.jpg\",\"bodyContent\":\"$28\",\"seoTitle\":\"Kırkgözler Pisti Canlı Kamera | Uludağ Webcam\",\"seoDescription\":\"Uludağ Kırkgözler pistinin canlı webcam yayını. 2. bölgenin bu sakin kırmızı pistindeki güncel kar ve pist koşullarını anlık takip edin.\",\"altitude\":null,\"latitude\":null,\"longitude\":null,\"name\":\"Kırkgözler Pisti Kamerası\",\"description\":\"Kırkgözler Pisti kamerası, Uludağ 2. bölgesinde oteller hattının kenarındaki bu sakin kırmızı pistin güncel kar ve görüş koşullarını canlı gösterir.\"}`;
const MONTE_BAIA = String.raw`{\"id\":\"cmqfk8fha00tmyxldr3thr109\",\"slug\":\"uludag-monte-baia\",\"streamUrl\":\"https://listen.powerapp.com.tr/powercam/montebaia/playlist.m3u8\",\"streamTokenUrl\":\"/v2/webcams/uludag-monte-baia/stream-token\",\"streamOnline\":false,\"streamCheckedAt\":\"2026-10-12T17:30:00.124Z\",\"snapshotUrl\":\"https://image.kayakmerkezleri.net/turkiye/bursa/uludag/monte-baia-webcam.jpg\",\"bodyContent\":\"$32\",\"seoTitle\":\"Monte Baia Otel Canlı Kamera | Uludağ Webcam\",\"seoDescription\":\"Uludağ Monte Baia Otel bölgesinin canlı webcam görüntüsü. 2. bölgedeki Monte Baia otel ve pist alanını anlık olarak takip edin.\",\"altitude\":null,\"latitude\":null,\"longitude\":null,\"name\":\"Monte Baia Otel Kamerası\",\"description\":\"Monte Baia Otel kamerası, Uludağ 2. bölgesinde otel pisti ve teras alanının anlık görüntüsünü sunar; 2. bölgede konaklayan aileler için sabah koşullarını öğrenmenin en hızlı yoludur.\"}`;

const push = (s: string) => `<script>self.__next_f.push([1,"${s}"])</script>`;
const page = (...objs: string[]) =>
  push(String.raw`6:[[\"$\",\"$L23\",null,{\"webcams\":[` + objs.join(',') + String.raw`],\"locale\":\"tr\"}],\"$L33\"]\n`);

describe('parseUludagWebcamPage', () => {
  it('maps each camera to its still, pinned at its lift or the resort', () => {
    expect(parseUludagWebcamPage(page(BECEREN, KIRKGOZLER))).toEqual([
      {
        id: 'tr-uludag-beceren-pisti',
        lat: 40.1040161,
        lng: 29.1328614,
        name: 'Beceren Pisti Kamerası',
        city: 'Bursa',
        country: 'Turkey',
        feed_url: 'https://live.dgn.net.tr/uludag/pkdwDihF.jpg',
        stream_type: 'jpg',
        external_url: 'https://www.uludaginfo.com/tr/webcam/uludag-beceren-pisti',
        source: 'Uludaginfo',
      },
      expect.objectContaining({ id: 'tr-uludag-kirkgozler', lat: 40.104492, lng: 29.1481695 }),
    ]);
  });

  it('drops cameras whose still is a third-party copy', () => {
    expect(parseUludagWebcamPage(page(KIRKGOZLER, MONTE_BAIA)).map(c => c.id)).toEqual(['tr-uludag-kirkgozler']);
  });

  it('reads a list split across flight-data chunks', () => {
    const whole = page(BECEREN, KIRKGOZLER);
    const cut = whole.indexOf(String.raw`\"slug\":\"uludag-kirkgozler`);
    const split = whole.slice(0, cut) + '"])</script>\n' + push(whole.slice(cut, whole.length - '"])</script>'.length));
    expect(parseUludagWebcamPage(split).map(c => c.id)).toEqual(['tr-uludag-beceren-pisti', 'tr-uludag-kirkgozler']);
  });

  it('drops duplicates', () => {
    expect(parseUludagWebcamPage(page(BECEREN, BECEREN))).toHaveLength(1);
  });

  it('finds nothing in a page without the list', () => {
    expect(parseUludagWebcamPage('<html><body>Bakım çalışması</body></html>')).toEqual([]);
    expect(parseUludagWebcamPage(push(String.raw`6:{\"webcams\":[{\"slug\":`))).toEqual([]);
  });
});

describe('mapUludagWebcam', () => {
  const base = { slug: 'uludag-maden', name: 'Maden Pisti Kamerası', snapshotUrl: 'https://live.dgn.net.tr/uludag/s5y670bc0z.jpg' };

  it('prefers upstream coordinates once the site publishes them', () => {
    expect(mapUludagWebcam({ ...base, latitude: 40.1, longitude: 29.16 })).toMatchObject({ lat: 40.1, lng: 29.16 });
  });

  it('drops coordinates outside Uludağ', () => {
    expect(mapUludagWebcam({ ...base, latitude: 0, longitude: 0 })).toBeNull();
    const b = ULUDAG_BOUNDS;
    const cam = mapUludagWebcam(base)!;
    expect(cam.lat > b.minLat && cam.lat < b.maxLat && cam.lng > b.minLng && cam.lng < b.maxLng).toBe(true);
  });

  it('drops rows without a slug or an https still on the camera host', () => {
    expect(mapUludagWebcam({ ...base, slug: null })).toBeNull();
    expect(mapUludagWebcam({ ...base, slug: '../x' })).toBeNull();
    expect(mapUludagWebcam({ ...base, snapshotUrl: 'http://live.dgn.net.tr/uludag/s5y670bc0z.jpg' })).toBeNull();
    expect(mapUludagWebcam({ ...base, snapshotUrl: null })).toBeNull();
    expect(mapUludagWebcam(null)).toBeNull();
  });

  it('falls back to a default name', () => {
    expect(mapUludagWebcam({ ...base, name: ' ' })?.name).toBe('Uludağ maden');
  });
});

// Live integration test — opt in with RUN_LIVE_TESTS=1.
const liveIt = process.env.RUN_LIVE_TESTS === '1' ? it : it.skip;

describe('fetchUludagCameras (live)', () => {
  liveIt('fetches the resort cameras', async () => {
    const cams = await fetchUludagCameras();
    expect(cams.length).toBeGreaterThan(5);
    expect(new Set(cams.map(c => c.id)).size).toBe(cams.length);
    for (const c of cams) {
      expect(c.id).toMatch(/^tr-uludag-[a-z0-9-]+$/);
      expect(c.feed_url).toMatch(/^https:\/\/live\.dgn\.net\.tr\//);
    }
  }, 20_000);
});
