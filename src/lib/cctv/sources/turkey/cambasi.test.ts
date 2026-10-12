import { describe, it, expect } from 'vitest';
import { parseCambasiGrid, mapCambasiChannel, fetchCambasiCameras, CAMBASI_BOUNDS } from './cambasi';

// Verbatim from https://live.owwo.com.tr/ (the grid cambasidoga.com/m/live-1 embeds), two of six channels.
const GRID = `
<div class="row">
    <div class="col-md-6"><iframe allowfullscreen="" frameborder="0" height="480" scrolling="no" src="https://broadcast.orbel.com.tr/966ca43a-23aa-4b50-8d65-92ddb9f04455.html" width="100%"></iframe></div>

    <div class="col-md-6"><iframe allowfullscreen="" frameborder="0" height="480" scrolling="no" src="https://broadcast.orbel.com.tr/78f3f18b-4b6c-430a-b9ff-0f1c079fe107.html" width="100%"></iframe></div>

</div>


<div style="display:none">
<iframe src="https://www.facebook.com/plugins/video.php?href=https%3A%2F%2Fwww.facebook.com%2FOrduBBld%2Fvideos%2F24938181779183807%2F&width=1280" width="1280" height="720" style="border:none;overflow:hidden" scrolling="no" frameborder="0" allowfullscreen="true" allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share" allowFullScreen="true"></iframe>
</div>
`;

// Verbatim from https://broadcast.orbel.com.tr/channels/966ca43a-23aa-4b50-8d65-92ddb9f04455/oembed.json.
const OEMBED = JSON.parse(`{
	"version": "1.0",
	"type": "video",
	"title": "ÇAMBAŞI - 1",
	"description": "ORBEL A.Ş",
	"author_name": "",
	"author_url": "https://broadcast.orbel.com.tr/966ca43a-23aa-4b50-8d65-92ddb9f04455.html",
	"provider_name": "datarhei Restreamer",
	"provider_url": "https://datarhei.org",
	"license": "CC BY-NC 4.0",
	"html": "<iframe src=\\"https://broadcast.orbel.com.tr/966ca43a-23aa-4b50-8d65-92ddb9f04455.html\\" width=\\"640\\" height=\\"360\\" frameborder=\\"no\\" scrolling=\\"no\\" allowfullscreen=\\"true\\"></iframe>",
	"width": 640,
	"height": 360,
	"thumbnail_url": "https://broadcast.orbel.com.tr/memfs/966ca43a-23aa-4b50-8d65-92ddb9f04455.jpg",
	"thumbnail_width": 640,
	"thumbnail_height": 360
}`);

describe('parseCambasiGrid', () => {
  it('reads the Restreamer channels in order and skips the hidden Facebook embed', () => {
    expect(parseCambasiGrid(GRID)).toEqual([
      '966ca43a-23aa-4b50-8d65-92ddb9f04455',
      '78f3f18b-4b6c-430a-b9ff-0f1c079fe107',
    ]);
  });

  it('drops repeated channels', () => {
    expect(parseCambasiGrid(GRID + GRID)).toHaveLength(2);
  });

  it('finds nothing in a page without the grid', () => {
    expect(parseCambasiGrid('<html><body>Bakım çalışması</body></html>')).toEqual([]);
  });
});

describe('mapCambasiChannel', () => {
  it('maps a channel to its stream, still and the resort live page', () => {
    expect(mapCambasiChannel('966ca43a-23aa-4b50-8d65-92ddb9f04455', 0, OEMBED)).toEqual({
      id: 'tr-cambasi-966ca43a-23aa-4b50-8d65-92ddb9f04455',
      lat: 40.6294087,
      lng: 37.9360227,
      name: 'ÇAMBAŞI - 1',
      city: 'Ordu',
      country: 'Turkey',
      feed_url: 'https://broadcast.orbel.com.tr/memfs/966ca43a-23aa-4b50-8d65-92ddb9f04455.jpg',
      stream_url: 'https://broadcast.orbel.com.tr/memfs/966ca43a-23aa-4b50-8d65-92ddb9f04455.m3u8',
      stream_type: 'hls',
      external_url: 'https://cambasidoga.com/m/live-1',
      source: 'Çambaşı Doğa Tesisleri (ORBEL A.Ş.)',
    });
  });

  it('numbers the channel when its oEmbed is missing', () => {
    expect(mapCambasiChannel('78f3f18b-4b6c-430a-b9ff-0f1c079fe107', 1, null)?.name).toBe('Çambaşı 2');
    expect(mapCambasiChannel('78f3f18b-4b6c-430a-b9ff-0f1c079fe107', 1, { title: '  ' })?.name).toBe('Çambaşı 2');
  });

  it('keeps neighbouring channels on distinct points inside the bounds', () => {
    const a = mapCambasiChannel('966ca43a-23aa-4b50-8d65-92ddb9f04455', 0)!;
    const b = mapCambasiChannel('78f3f18b-4b6c-430a-b9ff-0f1c079fe107', 1)!;
    expect(a.lng).not.toBe(b.lng);
    const bb = CAMBASI_BOUNDS;
    expect(b.lat > bb.minLat && b.lat < bb.maxLat && b.lng > bb.minLng && b.lng < bb.maxLng).toBe(true);
  });

  it('drops bad ids and positions that would leave the bounds', () => {
    expect(mapCambasiChannel('../memfs/x', 0)).toBeNull();
    expect(mapCambasiChannel('966ca43a-23aa-4b50-8d65-92ddb9f04455', -1)).toBeNull();
    expect(mapCambasiChannel('966ca43a-23aa-4b50-8d65-92ddb9f04455', 1000)).toBeNull();
  });
});

// Live integration test — opt in with RUN_LIVE_TESTS=1.
const liveIt = process.env.RUN_LIVE_TESTS === '1' ? it : it.skip;

describe('fetchCambasiCameras (live)', () => {
  liveIt('fetches the resort channels', async () => {
    const cams = await fetchCambasiCameras();
    expect(cams.length).toBeGreaterThan(0);
    expect(new Set(cams.map(c => c.id)).size).toBe(cams.length);
    for (const c of cams) {
      expect(c.id).toMatch(/^tr-cambasi-[0-9a-f-]{36}$/);
      expect(c.stream_url).toMatch(/^https:\/\/broadcast\.orbel\.com\.tr\/memfs\/[0-9a-f-]{36}\.m3u8$/);
    }
  }, 30_000);
});
