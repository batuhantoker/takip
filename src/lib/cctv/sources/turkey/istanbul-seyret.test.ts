import { afterEach, describe, it, expect, vi } from 'vitest';
import { parseSeyretList, seyretCameras, fetchIstanbulSeyretCameras, ISTANBUL_SEYRET_BOUNDS } from './istanbul-seyret';

afterEach(() => vi.unstubAllGlobals());

// Two entries from https://istanbuluseyret.ibb.istanbul/tr/turistik-kameralar (2026-10-13), indentation collapsed.
const LIST = `<div class="row kamera-item-list pt-3">
<div class="col-3">
<div class="d-flex position-relative flex-column p-0 p-sm-1">
<div class="kamera-item-img-list">
<a
href="https://istanbuluseyret.ibb.istanbul/tr/turistik-kamera/emirgan">
<img src="https://istanbuluseyret.ibb.istanbul/images/cameras/fullxfull/695ccccb7d457-3590.jpg"
alt="EMİRGAN"
class="img-fluid w-100 list" />
</a>
</div>
</div>
</div>
<div class="col-9">
<!-- kamera title -->
<div class="d-flex justify-content-start align-items-center border-bottom">
<span class="f-mp-bold fsize150"> <a
href="https://istanbuluseyret.ibb.istanbul/tr/turistik-kamera/emirgan"
class="text-primary">EMİRGAN</a></span>
</div>
<div class="d-flex justify-content-start border-bottom pb-3">
<div class="col-5">
<!-- kamera content -->
<p class="kamera-content m-0 f-mp lh-sm pt-4">
Lale bahçeleri, köşkleri ve eşsiz Boğaz manzarası ile İstanbul’un en güzel korularından biridir Emirgan. Her mevsim farklı bir güzelliğe bürünen koru, binlerce lalenin oluşturduğu renk cümbüşü ile İstanbul’da adeta ilkbaharın müjdesidir. Bizans döneminde Kiparodis (Kyparodes) yani “serviler” olarak adlandırılan Emirgan Korusu ve çevresinde yerleşim, 16’ncı yüzyılın ortalarında başlar. Sadrazam Sok...
</p>
<div class="row kamera-item-list pt-3">
<div class="col-3">
<div class="d-flex position-relative flex-column p-0 p-sm-1">
<div class="kamera-item-img-list">
<a
href="https://istanbuluseyret.ibb.istanbul/tr/turistik-kamera/kadikoy">
<img src="https://istanbuluseyret.ibb.istanbul/images/cameras/fullxfull/695ccd9181c8b-8883.jpg"
alt="KADIKÖY"
class="img-fluid w-100 list" />
</a>
</div>
</div>
</div>
<div class="col-9">
<!-- kamera title -->
<div class="d-flex justify-content-start align-items-center border-bottom">
<span class="f-mp-bold fsize150"> <a
href="https://istanbuluseyret.ibb.istanbul/tr/turistik-kamera/kadikoy"
class="text-primary">KADIKÖY</a></span>
</div>
<div class="d-flex justify-content-start border-bottom pb-3">
<div class="col-5">
<!-- kamera content -->
<p class="kamera-content m-0 f-mp lh-sm pt-4">
“Bu kamera, kişisel verilerin korunmasına yönelik tedbirler kapsamında yayından kaldırılmıştır.”
</p>`;

const FOOTER = '<footer><a href="/tr/sayfa/kvkk">Kişisel Verilerin Korunması</a></footer>';

describe('parseSeyretList', () => {
  it('lists cameras and skips those İBB took off air under KVKK', () => {
    expect(parseSeyretList(LIST)).toEqual(['emirgan']);
  });

  it('reads the notice from the entry, not the page footer', () => {
    expect(parseSeyretList(LIST + FOOTER)).toEqual(['emirgan']);
  });

  it('matches the notice in upper case too', () => {
    const shouting = LIST.replace('kişisel verilerin korunmasına', 'KİŞİSEL VERİLERİN KORUNMASINA');
    expect(shouting).not.toBe(LIST);
    expect(parseSeyretList(shouting)).toEqual(['emirgan']);
  });

  it('throws when the page no longer has the list', () => {
    expect(() => parseSeyretList('<html><body>Bakım çalışması</body></html>')).toThrow(/no cameras/);
  });
});

describe('seyretCameras', () => {
  it('maps a listed camera to its stream', () => {
    expect(seyretCameras(['emirgan'])).toEqual([{
      id: 'tr-seyret-emirgan',
      lat: 41.10584,
      lng: 29.05515,
      name: 'Emirgan',
      city: 'Istanbul',
      country: 'Turkey',
      stream_url: 'https://kamerayayin.ibb.istanbul/turistikcam/emirgan.stream/playlist.m3u8',
      stream_type: 'hls',
      external_url: 'https://istanbuluseyret.ibb.istanbul/tr/turistik-kamera/emirgan',
      source: "İBB İstanbul'u Seyret",
    }]);
  });

  it('skips cameras it has no stream for, including the four taken off air', () => {
    expect(seyretCameras(['kadikoy', 'misir-carsisi', 'miniaturk', 'sultanahmet', 'yeni-kamera'])).toEqual([]);
  });

  it('places every known camera inside the bounds', () => {
    const b = ISTANBUL_SEYRET_BOUNDS;
    const all = seyretCameras(['anadolu-hisari', 'beyazit-kulesi-2', 'beyazit-meydani', 'buyuk-camlica', 'dragos', 'eminonu',
      'emirgan', 'eyup-sultan', 'hidiv-kasri', 'kiz-kulesi', 'pierre-loti', 'salacak', 'sarachane', 'sultanahmet-2',
      'taksim-meydan', 'ulus-parki', 'uskudar']);
    expect(all).toHaveLength(17);
    for (const c of all) expect(c.lat > b.minLat && c.lat < b.maxLat && c.lng > b.minLng && c.lng < b.maxLng, c.id).toBe(true);
  });
});

describe('fetchIstanbulSeyretCameras', () => {
  it('fetches the list and maps what is live', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(LIST, { status: 200 })));
    expect((await fetchIstanbulSeyretCameras()).map(c => c.id)).toEqual(['tr-seyret-emirgan']);
  });

  it('throws on an HTTP error', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 503 })));
    await expect(fetchIstanbulSeyretCameras()).rejects.toThrow(/HTTP 503/);
  });
});

// Live integration test — opt in with RUN_LIVE_TESTS=1.
const liveIt = process.env.RUN_LIVE_TESTS === '1' ? it : it.skip;

describe('fetchIstanbulSeyretCameras (live)', () => {
  liveIt('maps every live camera on the list', async () => {
    const cams = await fetchIstanbulSeyretCameras();
    expect(cams.length).toBeGreaterThan(10);
    expect(cams.map(c => c.id)).not.toContain('tr-seyret-kadikoy');
  }, 20_000);
});
