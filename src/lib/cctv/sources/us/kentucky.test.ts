import { describe, it, expect } from 'vitest';
import { mapKytcCamera, snapshotUrl, type KytcCamera } from './kentucky';

// Verbatim from the KYTC trafficCamerasCur_Prd feature layer.
const camera: KytcCamera = {
  id: 526,
  status: 'Online',
  state: 'Kentucky',
  county: 'Jefferson',
  description: 'I-71 at Old Brownsboro Rd',
  snapshot: 'https://www.trimarc.org/images/milestone/CCTV_05_71_0103.jpg',
  latitude: 38.320179,
  longitude: -85.561249,
};

describe('mapKytcCamera', () => {
  it('maps a camera to its TRIMARC still', () => {
    expect(mapKytcCamera(camera)).toEqual({
      id: 'ky-kytc-526',
      lat: 38.320179,
      lng: -85.561249,
      name: 'I-71 at Old Brownsboro Rd',
      city: 'Jefferson County',
      country: 'US',
      feed_url: 'https://www.trimarc.org/images/milestone/CCTV_05_71_0103.jpg',
      stream_type: 'jpg',
      source: 'KYTC',
    });
  });

  it('drops the Indiana cameras the layer also lists', () => {
    // Verbatim: these carry no state, id or status at all.
    expect(mapKytcCamera({
      id: null,
      status: null,
      state: null,
      county: null,
      description: 'I-65 at SR 60 Exit 7 Indiana',
      snapshot: 'http://www.trimarc.org/images/snapshots/IND_CCTV005.jpg',
      latitude: 38.370025,
      longitude: -85.754724,
    })).toBeNull();
  });

  it('drops offline cameras', () => {
    expect(mapKytcCamera({ ...camera, status: 'Offline' })).toBeNull();
  });

  it('drops coordinates outside Kentucky', () => {
    expect(mapKytcCamera({ ...camera, latitude: 0, longitude: 0 })).toBeNull();
    expect(mapKytcCamera({ ...camera, latitude: null })).toBeNull();
  });

  it('drops a camera with no usable still', () => {
    expect(mapKytcCamera({ ...camera, snapshot: null })).toBeNull();
    expect(mapKytcCamera({ ...camera, snapshot: 'http://other-host.example/cam.jpg' })).toBeNull();
  });

  it('falls back when the description or county is missing', () => {
    const cam = mapKytcCamera({ ...camera, description: '  ', county: null });
    expect(cam?.name).toBe('KYTC Camera 526');
    expect(cam?.city).toBe('Kentucky');
  });
});

describe('snapshotUrl', () => {
  it('upgrades TRIMARC stills listed as http, which an https page would block', () => {
    expect(snapshotUrl('http://www.trimarc.org/images/milestone/CCTV_03_NashvilleRd_and_CampbellLn.jpg'))
      .toBe('https://www.trimarc.org/images/milestone/CCTV_03_NashvilleRd_and_CampbellLn.jpg');
  });

  it('keeps other https stills and rejects anything else', () => {
    expect(snapshotUrl('https://cams.example.gov/a.jpg')).toBe('https://cams.example.gov/a.jpg');
    expect(snapshotUrl('http://cams.example.gov/a.jpg')).toBeNull();
    expect(snapshotUrl('not a url')).toBeNull();
    expect(snapshotUrl(undefined)).toBeNull();
  });
});
