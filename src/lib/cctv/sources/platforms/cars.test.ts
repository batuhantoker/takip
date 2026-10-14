import { describe, it, expect } from 'vitest';
import { featurePoint, hlsUrl, mapCarsSnapshot, snapshotUrl, type CarsFeature, type CarsSource } from './cars';

const MNDOT: CarsSource = {
  host: '511mn.org', idPrefix: 'mndot', source: 'MnDOT', state: 'Minnesota',
  bounds: { minLat: 43.4, maxLat: 49.4, minLng: -97.3, maxLng: -89.4 },
};

// Verbatim from 511mn.org's MapFeatures response.
const camera: CarsFeature = {
  title: 'MN 36: Cleveland Ave SB @ Co Rd B',
  uri: 'camera/512007',
  features: [{ geometry: { coordinates: [-93.18755, 45.01002] } }],
  __typename: 'Camera',
  active: true,
  views: [{ category: 'IMAGE', url: 'https://public.carsprogram.org/cameras/MN/C30559?1791698100000' }],
};

describe('mapCarsSnapshot', () => {
  it('maps a camera to its still and its page on the state map', () => {
    expect(mapCarsSnapshot(camera, MNDOT)).toEqual({
      id: 'mndot-512007',
      lat: 45.01002,
      lng: -93.18755,
      name: 'MN 36: Cleveland Ave SB @ Co Rd B',
      city: 'Minnesota',
      country: 'US',
      feed_url: 'https://public.carsprogram.org/cameras/MN/C30559',
      stream_type: 'jpg',
      external_url: 'https://511mn.org/@45.01002,-93.18755,14?show=camera%2F512007',
      source: 'MnDOT',
    });
  });

  it('drops a camera that is down, whose view is a placeholder icon', () => {
    expect(mapCarsSnapshot({ ...camera, views: [{ category: 'IMAGE', url: '/images/icon-camera-closed-fill-solid-padded.svg' }] }, MNDOT)).toBeNull();
    expect(mapCarsSnapshot({ ...camera, views: [] }, MNDOT)).toBeNull();
  });

  it('drops inactive cameras, other features, and records with no id', () => {
    expect(mapCarsSnapshot({ ...camera, active: false }, MNDOT)).toBeNull();
    expect(mapCarsSnapshot({ ...camera, __typename: 'Event' }, MNDOT)).toBeNull();
    expect(mapCarsSnapshot({ ...camera, uri: 'event/1' }, MNDOT)).toBeNull();
  });

  it('falls back to a generated name', () => {
    expect(mapCarsSnapshot({ ...camera, title: '  ' }, MNDOT)?.name).toBe('MnDOT Camera 512007');
  });

  it('drops a still another source carries', () => {
    expect(mapCarsSnapshot(camera, { ...MNDOT, excludeFeeds: /\/cameras\/MN\// })).toBeNull();
    expect(mapCarsSnapshot(camera, { ...MNDOT, excludeFeeds: /\/cameras\/IA\// })?.id).toBe('mndot-512007');
  });

  it('adds the HLS stream when its host is listed', () => {
    // Verbatim view from 511mn.org with `sources` selected (2026-10-13).
    const live: CarsFeature = { ...camera, views: [{
      category: 'VIDEO', url: 'https://public.carsprogram.org/cameras/MN/C30559?1791698100000',
      sources: [{ type: 'application/x-mpegURL', src: 'https://video.dot.state.mn.us/public/C30559.stream/playlist.m3u8' }],
    }] };
    const cam = mapCarsSnapshot(live, { ...MNDOT, videoHosts: ['video.dot.state.mn.us'] });
    expect(cam).toMatchObject({
      feed_url: 'https://public.carsprogram.org/cameras/MN/C30559',
      stream_url: 'https://video.dot.state.mn.us/public/C30559.stream/playlist.m3u8',
      stream_type: 'hls',
    });
    expect(mapCarsSnapshot(live, MNDOT)?.stream_type).toBe('jpg');
    expect(mapCarsSnapshot(live, MNDOT)?.stream_url).toBeUndefined();
  });
});

describe('hlsUrl', () => {
  const view = (src: string, type = 'application/x-mpegURL') => ({ url: 'https://x.example/a.jpg', sources: [{ type, src }] });

  it('keeps listed https hosts and drops the default port', () => {
    expect(hlsUrl(view('https://66ec3d11858f4.streamlock.net:443/live/a_public.stream/playlist.m3u8'), ['66ec3d11858f4.streamlock.net']))
      .toBe('https://66ec3d11858f4.streamlock.net/live/a_public.stream/playlist.m3u8');
    expect(hlsUrl(view('https://video4.iowadot.gov:8888/ankeny/dmtv105lb/playlist.m3u8'), ['video4.iowadot.gov']))
      .toBe('https://video4.iowadot.gov:8888/ankeny/dmtv105lb/playlist.m3u8');
  });

  it('refuses unlisted hosts, plain http, other types and no list', () => {
    // Massachusetts: TrafficLand, a session token in the query.
    expect(hlsUrl(view('https://restream-5.trafficland.com/live/1107.stream/playlist.m3u8?token=1'), ['video.dot.state.mn.us'])).toBeNull();
    expect(hlsUrl(view('http://video.dot.state.mn.us/public/C1.stream/playlist.m3u8'), ['video.dot.state.mn.us'])).toBeNull();
    expect(hlsUrl(view('https://video.dot.state.mn.us/public/C1.mp4', 'video/mp4'), ['video.dot.state.mn.us'])).toBeNull();
    expect(hlsUrl(view('https://video.dot.state.mn.us/public/C1.stream/playlist.m3u8'), undefined)).toBeNull();
    expect(hlsUrl({ url: 'https://x.example/a.jpg', sources: null }, ['video.dot.state.mn.us'])).toBeNull();
  });
});

describe('featurePoint', () => {
  it('reads GeoJSON longitude first and drops points outside the box', () => {
    expect(featurePoint(camera, MNDOT.bounds)).toEqual({ lat: 45.01002, lng: -93.18755 });
    // KC Scout's Missouri-side cameras, as Kansas lists them.
    expect(featurePoint({ ...camera, features: [{ geometry: { coordinates: [-94.48, 39.06] } }] }, MNDOT.bounds)).toBeNull();
    expect(featurePoint({ ...camera, features: [] }, MNDOT.bounds)).toBeNull();
  });
});

describe('snapshotUrl', () => {
  it('drops the server-stamped cache-buster but keeps a real query', () => {
    expect(snapshotUrl('https://dot511.nebraska.gov/images/vid-001077037-03.jpg?1791697800000'))
      .toBe('https://dot511.nebraska.gov/images/vid-001077037-03.jpg');
    expect(snapshotUrl('https://cams.example.gov/still?id=4')).toBe('https://cams.example.gov/still?id=4');
  });

  it('rejects non-https and relative URLs', () => {
    expect(snapshotUrl('http://cams.example.gov/a.jpg')).toBeNull();
    expect(snapshotUrl('/images/icon.svg')).toBeNull();
    expect(snapshotUrl(null)).toBeNull();
  });
});
