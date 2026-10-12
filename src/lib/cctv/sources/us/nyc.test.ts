import { describe, it, expect } from 'vitest';
import { cameraName, fetchNycCameras, mapNycCamera, type NycCamera } from './nyc';

// Verbatim from webcams.nyctmc.org/api/cameras.
const camera: NycCamera = {
  id: '8a6bc417-4877-4ebe-8052-88c1b261baf1',
  name: 'Central Park West @ 86 St',
  latitude: 40.785302,
  longitude: -73.969353,
  area: 'Manhattan',
  isOnline: 'true',
  imageUrl: 'https://webcams.nyctmc.org/api/cameras/8a6bc417-4877-4ebe-8052-88c1b261baf1/image',
};

describe('mapNycCamera', () => {
  it('maps a camera to its still, captioned by borough', () => {
    expect(mapNycCamera(camera)).toEqual({
      id: 'nycdot-8a6bc417-4877-4ebe-8052-88c1b261baf1',
      lat: 40.785302,
      lng: -73.969353,
      name: 'Central Park West @ 86 St',
      city: 'Manhattan',
      country: 'US',
      feed_url: 'https://webcams.nyctmc.org/api/cameras/8a6bc417-4877-4ebe-8052-88c1b261baf1/image',
      stream_type: 'jpg',
      source: 'NYC DOT',
    });
  });

  it('drops offline cameras', () => {
    expect(mapNycCamera({ ...camera, isOnline: 'false' })).toBeNull();
    expect(mapNycCamera({ ...camera, isOnline: null })).toBeNull();
  });

  it('drops coordinates outside the city', () => {
    expect(mapNycCamera({ ...camera, latitude: 0, longitude: 0 })).toBeNull();
    expect(mapNycCamera({ ...camera, latitude: null })).toBeNull();
  });

  it('drops a camera with no id or no https still', () => {
    expect(mapNycCamera({ ...camera, id: null })).toBeNull();
    expect(mapNycCamera({ ...camera, imageUrl: 'http://webcams.nyctmc.org/api/cameras/x/image' })).toBeNull();
    expect(mapNycCamera({ ...camera, imageUrl: null })).toBeNull();
  });

  it('falls back when the name or borough is missing', () => {
    const cam = mapNycCamera({ ...camera, name: ' ', area: null });
    expect(cam?.name).toBe('NYC DOT Camera');
    expect(cam?.city).toBe('New York City');
  });
});

describe('cameraName', () => {
  it('turns expressway asset codes into labels', () => {
    expect(cameraName('C2-BQE-22-WB_at_Lee_Ave-Ex31')).toBe('BQE WB at Lee Ave Exit 31');
    expect(cameraName('C3-SIE-06A-E_at_Crafton_Ave_Ex10')).toBe('SIE E at Crafton Ave Exit 10');
    expect(cameraName('C1-BRE-06_W - WB_at_CBX-Hutch_Int-EX6A')).toBe('BRE W - WB at CBX-Hutch Int Exit 6A');
    expect(cameraName('C3-SIE-09-EB_at_ Manor_Rd')).toBe('SIE EB at Manor Rd');
  });

  it('leaves street names alone', () => {
    expect(cameraName('Bruckner Blvd E @ Castle Hill Ave ')).toBe('Bruckner Blvd E @ Castle Hill Ave');
    expect(cameraName('Harlem River Dr Ramp @ Before GWB & Amst_179St Exit')).toBe('Harlem River Dr Ramp @ Before GWB & Amst_179St Exit');
    expect(cameraName(null)).toBeNull();
  });
});

const liveIt = process.env.RUN_LIVE_TESTS === '1' ? it : it.skip;

liveIt('fetches a large set of well-formed NYC DOT cameras', async () => {
  const cams = await fetchNycCameras();
  expect(cams.length).toBeGreaterThan(750);
  expect(new Set(cams.map(c => c.id)).size).toBe(cams.length);
  for (const c of cams) {
    expect(c.id).toMatch(/^nycdot-[\w-]+$/);
    expect(c.source).toBe('NYC DOT');
    expect(c.feed_url).toMatch(/^https:\/\/webcams\.nyctmc\.org\/api\/cameras\/[\w-]+\/image$/);
  }
});
