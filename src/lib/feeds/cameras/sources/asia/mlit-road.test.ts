import { afterEach, describe, it, expect, vi } from 'vitest';
import { parseRoadImagePage, mapRoadImage, fetchMlitRoadCameras, type RoadImageRecord } from './mlit-road';

afterEach(() => vi.unstubAllGlobals());

// Trimmed from www.road-info-prvs.mlit.go.jp/roadinfo/pc/pcImage_8{2,3,6}_1.html (2026-10-12): one camera
// each from Kanto (.jpeg), Tohoku (.jpg) and Kinki (no picture), merged into one page.
const PAGE = String.raw`
        <input type="hidden" id="todofukenJson" value='[
      { "todofuken_cd":"08", "todofuken_mei":"茨城県" }
    , { "todofuken_cd":"20", "todofuken_mei":"長野県" }
]' />
        <input type="hidden" id="kokudoJson"    value='{"10001&E52\u4e2d\u90e8\u6a2a\u65ad\u81ea\u52d5\u8eca\u9053":[{"R_10001":{"doro_gazo_joho_kanri_id":"83C02947","seibikyoku_cd":"83","jimusho_cd":"837000","todofuken_cd":"20","cities_cd":"20217","cities_name":"\u4f50\u4e45\u5e02","area_cd":"20","area_name":"\u9577\u91ce\u770c","gis_point":["138.4485028","36.26068056"],"image_name":"\u4e2d\u90e8\u6a2a\u65ad\u3000\u30005.7KP\u3000\u65cb\u56de","teikyo_rosen_mei":"E52\u4e2d\u90e8\u6a2a\u65ad\u81ea\u52d5\u8eca\u9053","rosen_no":10001,"kokudo_no":null,"kansoku_chiten_mei":"\u4e2d\u90e8\u6a2a\u65ad\u3000\u30005.7KP\u3000\u65cb\u56de","shozaichi":"\u4f50\u4e45\u5e02","shozaichi_en":"Tsukabara, Saku City, Nagano Prefecture","kyorihyo":"5.7","fileList":[{"get_datetime":"2026-10-13 02:45:25","kiki_jotai_cd":1,"file":"20261013024500\/s_83C02947.jpeg"},{"get_datetime":"2026-10-13 02:30:25","kiki_jotai_cd":1,"file":"20261013023000\/s_83C02947.jpeg"},{"get_datetime":"2026-10-13 02:15:25","kiki_jotai_cd":1,"file":"20261013021500\/s_83C02947.jpeg"}]}}],"10007&E7\u79cb\u7530\u81ea\u52d5\u8eca\u9053":[{"R_10007":{"doro_gazo_joho_kanri_id":"82C05612","seibikyoku_cd":"82","jimusho_cd":"824700","todofuken_cd":"05","cities_cd":"05213","cities_name":"\u5317\u79cb\u7530\u5e02","area_cd":"05","area_name":"\u79cb\u7530\u770c","gis_point":["140.3044444","40.2058333"],"image_name":"\u87f9\u6ca2\u5927\u6a4b","teikyo_rosen_mei":"E7\u79cb\u7530\u81ea\u52d5\u8eca\u9053","rosen_no":10007,"kokudo_no":null,"kansoku_chiten_mei":"\u87f9\u6ca2\u5927\u6a4b","shozaichi":"\u79cb\u7530\u770c \u5317\u79cb\u7530\u5e02 \u574a\u6ca2","shozaichi_en":"E7 AKITA Expressway","kyorihyo":"197.36","fileList":[{"get_datetime":"2026-10-13 02:45:00","kiki_jotai_cd":1,"file":"20261013024500\/s_82C05612.jpg"},{"get_datetime":"2026-10-13 02:30:00","kiki_jotai_cd":1,"file":"20261013023000\/s_82C05612.jpg"},{"get_datetime":"2026-10-13 02:15:00","kiki_jotai_cd":1,"file":"20261013021500\/s_82C05612.jpg"}]}}],"10483&E72\u5317\u8fd1\u757f\u8c4a\u5ca1\u81ea\u52d5\u8eca\u9053":[{"R_10483":{"doro_gazo_joho_kanri_id":"86C04241","seibikyoku_cd":"86","jimusho_cd":"866100","todofuken_cd":"28","cities_cd":"28222","cities_name":"\u990a\u7236\u5e02","area_cd":"28","area_name":"\u5175\u5eab\u770c","gis_point":["134.7678723","35.43379961"],"image_name":"\u9752\u8c3fTN\u3000\u6625\u65e5\u5074","teikyo_rosen_mei":"E72\u5317\u8fd1\u757f\u8c4a\u5ca1\u81ea\u52d5\u8eca\u9053","rosen_no":10483,"kokudo_no":null,"kansoku_chiten_mei":"\u9752\u8c3fTN\u3000\u6625\u65e5\u5074","shozaichi":"\u5175\u5eab\u770c\u990a\u7236\u5e02\u516b\u9e7f\u753a\u5bbf\u5357","shozaichi_en":"Shukunami, Yabu City, Hyogo Prefecture","kyorihyo":"15.48","fileList":[{"get_datetime":"","kiki_jotai_cd":"","file":"s_no_data.jpeg"},{"get_datetime":"","kiki_jotai_cd":"","file":"s_no_data.jpeg"},{"get_datetime":"","kiki_jotai_cd":"","file":"s_no_data.jpeg"}]}}]}'    />

        <!-- 一覧ウィンドウ -->
`;

const [saku, kanizawa, aodani] = parseRoadImagePage(PAGE);

describe('parseRoadImagePage', () => {
  it('reads every record under every route', () => {
    expect(parseRoadImagePage(PAGE).map(r => r.doro_gazo_joho_kanri_id)).toEqual(['83C02947', '82C05612', '86C04241']);
  });

  it('throws on a page without the camera list', () => {
    expect(() => parseRoadImagePage('<html></html>')).toThrow(/no kokudoJson/);
  });
});

describe('mapRoadImage', () => {
  it('maps a camera to its latest full-size still', () => {
    expect(mapRoadImage(saku)).toEqual({
      id: 'mlit-road-83C02947',
      lat: 36.26068056,
      lng: 138.4485028,
      name: 'E52中部横断自動車道 中部横断 5.7KP 旋回',
      city: '佐久市',
      country: 'Japan',
      feed_url: 'https://www.road-info-prvs.mlit.go.jp/roadinfo/img/doro_gazo/pc/20261013024500/83C02947.jpeg',
      external_url: 'https://www.road-info-prvs.mlit.go.jp/roadinfo/',
      source: 'MLIT 道路情報提供システム',
    });
  });

  it('keeps a .jpg still as .jpg', () => {
    expect(mapRoadImage(kanizawa)?.feed_url)
      .toBe('https://www.road-info-prvs.mlit.go.jp/roadinfo/img/doro_gazo/pc/20261013024500/82C05612.jpg');
  });

  it('drops cameras with no picture or a fault status', () => {
    expect(mapRoadImage(aodani)).toBeNull();
    const latest = saku.fileList![0];
    expect(mapRoadImage({ ...saku, fileList: [{ ...latest, kiki_jotai_cd: 2 }] })).toBeNull();
    expect(mapRoadImage({ ...saku, fileList: [] })).toBeNull();
    expect(mapRoadImage({ ...saku, fileList: null })).toBeNull();
  });

  it('drops a still that is not this camera or not a plain path', () => {
    const latest = saku.fileList![0];
    const withFile = (file: string): RoadImageRecord => ({ ...saku, fileList: [{ ...latest, file }] });
    expect(mapRoadImage(withFile('20261013024500/s_83C02948.jpeg'))).toBeNull();
    expect(mapRoadImage(withFile('../20261013024500/s_83C02947.jpeg'))).toBeNull();
    expect(mapRoadImage(withFile('20261013024500/83C02947.jpeg'))).toBeNull();
    expect(mapRoadImage(withFile('20261013024500/s_83C02947.png'))).toBeNull();
  });

  it('drops missing, zero, swapped and foreign coordinates', () => {
    expect(mapRoadImage({ ...saku, gis_point: null })).toBeNull();
    expect(mapRoadImage({ ...saku, gis_point: ['', ''] })).toBeNull();
    expect(mapRoadImage({ ...saku, gis_point: ['0', '0'] })).toBeNull();
    expect(mapRoadImage({ ...saku, gis_point: ['36.26068056', '138.4485028'] })).toBeNull();
    // Manila.
    expect(mapRoadImage({ ...saku, gis_point: ['120.984', '14.599'] })).toBeNull();
  });

  it('falls back to a default name', () => {
    expect(mapRoadImage({ ...saku, teikyo_rosen_mei: null, kansoku_chiten_mei: ' ' })?.name).toBe('Road camera 83C02947');
  });
});

describe('fetchMlitRoadCameras', () => {
  it('reads every bureau, tolerating ones that fail', async () => {
    const fetch = vi.fn(async (url: string) => (url.endsWith('/pc/pcImage_83_1.html')
      ? new Response(PAGE, { status: 200 })
      : new Response('', { status: 404 })));
    vi.stubGlobal('fetch', fetch);

    expect((await fetchMlitRoadCameras()).map(c => c.id)).toEqual(['mlit-road-83C02947', 'mlit-road-82C05612']);
    expect(fetch).toHaveBeenCalledTimes(10);
    expect(fetch).toHaveBeenCalledWith('https://www.road-info-prvs.mlit.go.jp/roadinfo/pc/pcImage_81_1.html', expect.anything());
    expect(fetch).toHaveBeenCalledWith('https://www.road-info-prvs.mlit.go.jp/roadinfo/pc/pcImage_90_1.html', expect.anything());
  });

  it('throws when no bureau answers', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 503 })));
    await expect(fetchMlitRoadCameras()).rejects.toThrow(/no bureau answered/);
  });

  it('treats a page without the camera list as a failure', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<html></html>', { status: 200 })));
    await expect(fetchMlitRoadCameras()).rejects.toThrow(/no bureau answered/);
  });
});

// Live integration test — opt in with RUN_LIVE_TESTS=1. One run is one production refresh: 10 GETs.
const liveIt = process.env.RUN_LIVE_TESTS === '1' ? it : it.skip;

describe('fetchMlitRoadCameras (live)', () => {
  liveIt('fetches every bureau', async () => {
    const cams = await fetchMlitRoadCameras();
    expect(cams.length).toBeGreaterThan(1500);
    expect(new Set(cams.map(c => c.id)).size).toBe(cams.length);
    for (const cam of cams) {
      expect(cam.feed_url).toMatch(/^https:\/\/www\.road-info-prvs\.mlit\.go\.jp\/roadinfo\/img\/doro_gazo\/pc\/\d{14}\/\w+\.jpe?g$/);
    }
  }, 60000);
});
