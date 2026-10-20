import { describe, expect, it } from 'vitest';
import { LIVE_CHANNELS, liveEmbedUrl } from './live-tv';

describe('LIVE_CHANNELS', () => {
  it('names each channel once, by a well-formed YouTube channel id', () => {
    expect(new Set(LIVE_CHANNELS.map(c => c.id)).size).toBe(LIVE_CHANNELS.length);
    expect(new Set(LIVE_CHANNELS.map(c => c.channel)).size).toBe(LIVE_CHANNELS.length);
    for (const c of LIVE_CHANNELS) expect(c.channel, c.id).toMatch(/^UC[\w-]{22}$/);
  });

  it('places every newsroom on the map', () => {
    for (const c of LIVE_CHANNELS) {
      expect(Math.abs(c.lat), c.id).toBeLessThanOrEqual(90);
      expect(Math.abs(c.lng), c.id).toBeLessThanOrEqual(180);
      expect(c.country, c.id).toMatch(/^[A-Z]{2}$/);
    }
  });

  it('plays a channel muted, from the origin the map tiles listen to', () => {
    expect(liveEmbedUrl({ channel: 'UCknLrEdhRCp1aegoMqRaCZg' }))
      .toBe('https://www.youtube.com/embed/live_stream?channel=UCknLrEdhRCp1aegoMqRaCZg&autoplay=1&mute=1');
  });
});
