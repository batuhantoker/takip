import { describe, it, expect } from 'vitest';
import type { CctvCamera } from '@/lib/feeds/cameras/types';
import { isYouTubeUrl, parseYouTubeUrl } from '@/lib/feeds/cameras/youtube';
import {
  OWDB_AMERICAS, OWDB_AMERICAS_BOUNDS,
  OWDB_EMEA, OWDB_EMEA_BOUNDS,
  OWDB_APAC, OWDB_APAC_BOUNDS,
} from './openwebcamdb.generated';
import {
  NETHERLANDS_PUBLIC_WEBCAMS,
  EUROPE_PUBLIC_WEBCAMS,
  AMERICAS_PUBLIC_WEBCAMS,
  REST_PUBLIC_WEBCAMS,
} from './public-webcams.generated';

const GROUPS = [
  { cams: OWDB_AMERICAS, bounds: OWDB_AMERICAS_BOUNDS },
  { cams: OWDB_EMEA, bounds: OWDB_EMEA_BOUNDS },
  { cams: OWDB_APAC, bounds: OWDB_APAC_BOUNDS },
];
const ALL: CctvCamera[] = GROUPS.flatMap((g) => g.cams);
const urls = (c: CctvCamera) => [c.feed_url, c.stream_url, c.external_url].filter((u): u is string => Boolean(u));

// Guards the generator in scratch/scrape_openwebcamdb.js, not the upstream site.
describe('OpenWebcamDB set', () => {
  it('has a unique, prefixed id for every camera', () => {
    for (const g of GROUPS) expect(g.cams.length).toBeGreaterThan(0);
    const ids = ALL.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^owdb-[a-z0-9-]+$/);
  });

  it('keeps each camera inside the box its region loads for', () => {
    for (const { cams, bounds: b } of GROUPS) {
      for (const c of cams) {
        expect(c.lat > b.minLat && c.lat < b.maxLat && c.lng > b.minLng && c.lng < b.maxLng, c.id).toBe(true);
        expect(c.lat === 0 && c.lng === 0, c.id).toBe(false);
      }
    }
  });

  it('gives every camera something to show, over https', () => {
    for (const c of ALL) {
      expect(urls(c).length, c.id).toBeGreaterThan(0);
      expect(c.name.length, c.id).toBeGreaterThan(0);
      expect(c.city.length, c.id).toBeGreaterThan(0);
      expect(c.source).toBe('OpenWebcamDB');
      for (const u of urls(c)) {
        expect(u, c.id).toMatch(/^https:\/\//);
        expect(u, c.id).not.toMatch(/\/\/[^/]*@|pwd=|axis-cgi|guestimage\.html|nphMotionJpeg/i);
      }
      if (c.stream_url) expect(c.stream_type, c.id).toMatch(/^(iframe|hls)$/);
      if (c.feed_url) expect(c.stream_type, c.id).toBe('jpg');
    }
  });

  it('points YouTube cameras at a shape the viewer can play or resolve', () => {
    const youtube = ALL.filter((c) => isYouTubeUrl(c.external_url ?? ''));
    expect(youtube.length).toBeGreaterThan(100);
    for (const c of youtube) {
      expect(parseYouTubeUrl(c.external_url!)?.kind, `${c.id}: ${c.external_url}`).toMatch(/^(video|live-channel)$/);
      expect(c.stream_url, c.id).toBeUndefined();
    }
  });

  it('leaves out cameras the public webcam set already has', () => {
    const theirs = new Set(
      [...NETHERLANDS_PUBLIC_WEBCAMS, ...EUROPE_PUBLIC_WEBCAMS, ...AMERICAS_PUBLIC_WEBCAMS, ...REST_PUBLIC_WEBCAMS]
        .flatMap(urls),
    );
    for (const c of ALL) for (const u of urls(c)) expect(theirs.has(u), `${c.id}: ${u}`).toBe(false);
  });
});
