import { describe, it, expect, vi, afterEach } from 'vitest';
import { MUP_CROSSINGS, MUP_SERBIA_BOUNDS, fetchMupSerbiaCameras, mapMupStream, parseMupPage } from './mup-serbia';

// Verbatim from the MUP border-camera portal, 2026-10-12.
const ITEM = `<li id="id_7da5fda4-7548-462a-a0b0-0e6eaaa4c565" >
  <a href="#" onclick="toggleCamera('7da5fda4-7548-462a-a0b0-0e6eaaa4c565','https://kamere.mup.gov.rs:4443/Gradina/gradina1.m3u8', 'https://kamere.mup.gov.rs:4443/Gradina/gradina2.m3u8');return false;">
         Гранични прелаз Градина
  </a>
</li>`;
const UNPLACED = `toggleCamera('1d38255b-5e1a-44f7-ad15-3a9e4b441045','https://kamere.mup.gov.rs:4443/Djala/djala2.m3u8', 'https://kamere.mup.gov.rs:4443/Djala/djala1.m3u8')`;
// The page's own handler, which must not be read as a camera.
const HANDLER = 'toggleCamera(current_camera_div_id, camera1Stream, camera2Stream)';

describe('parseMupPage', () => {
  it('reads both streams of each crossing', () => {
    expect(parseMupPage(ITEM + UNPLACED + HANDLER).map(s => s.file)).toEqual(['gradina1', 'gradina2', 'djala2', 'djala1']);
  });
});

describe('mapMupStream', () => {
  it('places a stream at its crossing', () => {
    expect(mapMupStream({ folder: 'Gradina', file: 'gradina2', url: 'https://kamere.mup.gov.rs:4443/Gradina/gradina2.m3u8' })).toEqual({
      id: 'mup-gradina2',
      lat: 42.99924,
      lng: 22.82943,
      name: 'Border crossing Gradina (camera 2)',
      city: 'To Bulgaria',
      country: 'Serbia',
      stream_url: 'https://kamere.mup.gov.rs:4443/Gradina/gradina2.m3u8',
      stream_type: 'hls',
      external_url: 'https://www.mup.gov.rs/wps/portal/sr/kamer%D0%B5/kamer%D0%B5GP',
      source: 'MUP Serbia',
    });
  });

  it('leaves out crossings without a gazetteer point', () => {
    expect(mapMupStream({ folder: 'Djala', file: 'djala1', url: 'https://kamere.mup.gov.rs:4443/Djala/djala1.m3u8' })).toBeNull();
  });

  it('keeps every crossing inside the country box', () => {
    for (const c of Object.values(MUP_CROSSINGS)) {
      expect(c.lat > MUP_SERBIA_BOUNDS.minLat && c.lat < MUP_SERBIA_BOUNDS.maxLat).toBe(true);
      expect(c.lng > MUP_SERBIA_BOUNDS.minLng && c.lng < MUP_SERBIA_BOUNDS.maxLng).toBe(true);
    }
  });
});

describe('fetchMupSerbiaCameras', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('keeps only streams whose playlist answers', async () => {
    const page = (ITEM + UNPLACED).repeat(1) + Array.from({ length: 10 }, (_, i) =>
      `toggleCamera('x','https://kamere.mup.gov.rs:4443/Sid/sid${i}a.m3u8', 'https://kamere.mup.gov.rs:4443/Sid/sid${i}b.m3u8')`).join('');
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url.includes('mup.gov.rs/wps')) return new Response(page);
      if (url.endsWith('gradina1.m3u8')) return new Response('#EXTM3U\n#EXT-X-TARGETDURATION:6\n');
      return new Response('<!DOCTYPE html>', { status: 404 });
    }));
    expect((await fetchMupSerbiaCameras()).map(c => c.id)).toEqual(['mup-gradina1']);
  });
});

const liveIt = process.env.RUN_LIVE_TESTS === '1' ? it : it.skip;
liveIt('fetches the live MUP border streams', async () => {
  const cams = await fetchMupSerbiaCameras();
  expect(cams.length).toBeGreaterThan(0);
  for (const c of cams) expect(c.stream_url).toMatch(/^https:\/\/kamere\.mup\.gov\.rs:4443\//);
}, 60_000);
