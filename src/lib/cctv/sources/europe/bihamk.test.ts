import { describe, it, expect } from 'vitest';
import { BIHAMK_BOUNDS, BIHAMK_PLACES, fetchBihamkCameras, mapBihamkCamera, parseBihamkPage } from './bihamk';

// Verbatim card markup from bihamk.ba/spi/kamere, 2026-10-12.
const CARD = `<article class="w-full flex flex-col relative cursor-pointer group"
                                 wire:click="loadModal(377)"
                                 wire:key="377"
                                 wire:transition
                        >
                            <figure class="relative">
                                <!--[if BLOCK]><![endif]-->                                    <img alt="GP Bijača" src="https://video-nadzor.bihamk.ba/videosurveillence/BIJACA.jpg?1791836298" width="234" height="200" class="w-full object-cover">`;
const UNPLACED = '<img alt="GP Prisika" src="https://video-nadzor.bihamk.ba/videosurveillence/PRISIKA.jpg?1791836298" width="234">';

describe('parseBihamkPage', () => {
  it('reads each camera card once', () => {
    expect(parseBihamkPage(CARD + CARD + UNPLACED)).toEqual([
      { key: 'BIJACA', name: 'GP Bijača' },
      { key: 'PRISIKA', name: 'GP Prisika' },
    ]);
  });
});

describe('mapBihamkCamera', () => {
  it('places a camera from the gazetteer, without the cache-buster', () => {
    expect(mapBihamkCamera({ key: 'BIJACA', name: 'GP Bijača' })).toEqual({
      id: 'bihamk-bijaca',
      lat: 43.12323,
      lng: 17.57493,
      name: 'Border crossing Bijača',
      city: 'Ljubuški',
      country: 'Bosnia and Herzegovina',
      feed_url: 'https://video-nadzor.bihamk.ba/videosurveillence/BIJACA.jpg',
      stream_type: 'jpg',
      external_url: 'https://bihamk.ba/spi/kamere',
      source: 'BIHAMK',
    });
  });

  it('leaves out cameras it cannot place', () => {
    expect(mapBihamkCamera({ key: 'PRISIKA', name: 'GP Prisika' })).toBeNull();
  });

  it('keeps every gazetteer point inside the country box', () => {
    for (const p of Object.values(BIHAMK_PLACES)) {
      expect(p.lat).toBeGreaterThan(BIHAMK_BOUNDS.minLat);
      expect(p.lat).toBeLessThan(BIHAMK_BOUNDS.maxLat);
      expect(p.lng).toBeGreaterThan(BIHAMK_BOUNDS.minLng);
      expect(p.lng).toBeLessThan(BIHAMK_BOUNDS.maxLng);
    }
  });
});

const liveIt = process.env.RUN_LIVE_TESTS === '1' ? it : it.skip;
liveIt('fetches the BIHAMK cameras', async () => {
  const cams = await fetchBihamkCameras();
  expect(cams.length).toBeGreaterThanOrEqual(10);
  expect(new Set(cams.map(c => c.id)).size).toBe(cams.length);
});
