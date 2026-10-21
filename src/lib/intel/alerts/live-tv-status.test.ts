import { describe, expect, it } from 'vitest';
import { parseLivePage } from './live-tv-status';

const player = (o: unknown) => `<html><head><link rel="canonical" href="https://www.youtube.com/watch?v=gCNeDWCI0vo"></head><body>
<script>var ytInitialPlayerResponse = ${JSON.stringify(o)};var meta = document.createElement('meta');</script></body></html>`;

const LIVE = {
  playabilityStatus: { status: 'OK', playableInEmbed: true },
  videoDetails: { videoId: 'gCNeDWCI0vo', title: 'Al Jazeera English | Live {24/7} "news"', isLive: true },
};

describe('parseLivePage', () => {
  it('reads the broadcast on air and whether it may be embedded', () => {
    expect(parseLivePage(player(LIVE))).toEqual({ live: true, video: 'gCNeDWCI0vo', embed: true });
    expect(parseLivePage(player({ ...LIVE, playabilityStatus: { status: 'OK', playableInEmbed: false } })))
      .toEqual({ live: true, video: 'gCNeDWCI0vo', embed: false });
  });

  it('calls an upcoming broadcast off air, though it sits on /live with a video id', () => {
    const upcoming = { playabilityStatus: { status: 'LIVE_STREAM_OFFLINE', playableInEmbed: true }, videoDetails: { videoId: 'Pgph7__6ytQ', isUpcoming: true } };
    expect(parseLivePage(player(upcoming))).toEqual({ live: false, video: null, embed: false });
  });

  it('calls a channel page off air: /live goes there when nothing is broadcasting', () => {
    const home = `<link rel="canonical" href="https://www.youtube.com/channel/UCI3RT5PGmdi1KVp9FG_CneA"><script>(function(a){})(a.ytInitialPlayerResponse)</script>`;
    expect(parseLivePage(home)).toEqual({ live: false, video: null, embed: false });
  });

  it('knows nothing from a page that is neither, or a player cut short', () => {
    expect(parseLivePage('<html>Before you continue to YouTube</html>')).toBeNull();
    expect(parseLivePage(player(LIVE).slice(0, 200))).toBeNull();
  });

  it('does not take a malformed id', () => {
    expect(parseLivePage(player({ ...LIVE, videoDetails: { ...LIVE.videoDetails, videoId: '"><script>' } })))
      .toEqual({ live: false, video: null, embed: false });
  });
});
