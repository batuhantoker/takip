import { describe, it, expect } from 'vitest';
import { mapWebcam, collectWebcams, fetchOpenDataHubCameras, ODH_BOUNDS, type OdhWebcam } from './opendatahub';

// Trimmed rows from tourism.api.opendatahub.com/v1/WebcamInfo (2026-10-12).
const canazei: OdhWebcam = {
  Id: 'DSS_11885478', Source: 'dss', Active: true, Shortname: 'Canazei - Alba di Canazei',
  GpsInfo: [{ Latitude: 46.476940647751, Longitude: 11.810216903687 }],
  Webcamurl: 'https://panodata.panomax.com/cams/1343/sassolungo_e_sella.jpg',
  Streamurl: 'https://panodata.panomax.com/cams/1343/sassolungo_e_sella.jpg',
  ImageGallery: [{ ImageUrl: 'https://panodata.panomax.com/cams/1343/sassolungo_e_sella.jpg' }],
  LicenseInfo: { License: 'CC0', ClosedData: false },
};

const unlicensed: OdhWebcam = {
  Id: '58ADDC39-029D-5E66-2D30-DACC8A7FF0C3', Source: 'idm', Active: true,
  Shortname: 'Uwaldalm / St. Magdalena - Gsieser Tal',
  GpsInfo: [{ Latitude: 46.85137, Longitude: 12.2646322 }],
  Webcamurl: 'https://webcams.kronplatz.com/webcam/gsiweltaittv/cam1/webcam3.jpg', Streamurl: null,
  ImageGallery: [{ ImageUrl: 'https://webcams.kronplatz.com/webcam/gsiweltaittv/cam1/webcam3.jpg' }],
  LicenseInfo: { License: '', ClosedData: false },
};

const a22: OdhWebcam = {
  Id: 'A22_68', Source: 'a22', Active: true, Shortname: 'ADS Sciliar',
  GpsInfo: [{ Latitude: 46.53591, Longitude: 11.49772 }],
  Webcamurl: 'https://www.autobrennero.it/WebCamImg/km68.jpg', Streamurl: null,
  ImageGallery: [{ ImageUrl: 'https://www.autobrennero.it/WebCamImg/km68.jpg' }],
  LicenseInfo: { License: 'CC0', ClosedData: false },
};

const feratelThumb: OdhWebcam = {
  Id: 'DSS_58920412', Source: 'dss', Active: true, Shortname: 'Alta Badia, Grödner Joch',
  GpsInfo: [{ Latitude: 46.554453677396, Longitude: 11.805142667145 }],
  Webcamurl: 'https://wtvthmb.feratel.com/thumbnails/6322.jpeg?t=38&dcsdesign=Dolomitisuperski&design=v5',
  Streamurl: 'https://webtv.feratel.com/webtv/?design=v5&pg=661739B9-8377-4401-8A37-6B9FA40523F4&cam=6322',
  ImageGallery: [{ ImageUrl: 'https://wtvthmb.feratel.com/thumbnails/6322.jpeg?t=38&dcsdesign=Dolomitisuperski&design=v5' }],
  LicenseInfo: { License: 'CC0', ClosedData: false },
};

const fallbackPoint: OdhWebcam = {
  Id: 'DSS_1744115140', Source: 'dss', Active: true, Shortname: 'Oclini',
  GpsInfo: [{ Latitude: 46.57416242246033, Longitude: 11.673888187402358 }],
  Webcamurl: 'https://oclini.com/webcam/webcam4.jpg', Streamurl: null,
  ImageGallery: [{ ImageUrl: 'https://oclini.com/webcam/webcam4.jpg' }],
  LicenseInfo: { License: 'CC0', ClosedData: false },
};

// The same Kronplatz still, listed by both dss and idm.
const olangDss: OdhWebcam = {
  Id: 'DSS_6124', Source: 'dss', Active: true, Shortname: 'Kronplatz / Olang',
  GpsInfo: [{ Latitude: 46.73852055562422, Longitude: 11.957532934423826 }],
  Webcamurl: 'https://webcams.kronplatz.com/webcam/kronplatz/30/webcam3.jpg', Streamurl: null,
  ImageGallery: [{ ImageUrl: 'https://webcams.kronplatz.com/webcam/kronplatz/30/webcam3.jpg' }],
  LicenseInfo: { License: 'CC0', ClosedData: false },
};
const olangIdm: OdhWebcam = {
  Id: '3847E129-8234-A734-B2D7-1B30D84CFAF5', Source: 'idm', Active: true, Shortname: 'Gsieser Tal Welsberg Taisten',
  GpsInfo: [{ Latitude: 46.7394026, Longitude: 11.9593431 }],
  Webcamurl: 'https://webcams.kronplatz.com/webcam/kronplatz/30/webcam3.jpg', Streamurl: null,
  ImageGallery: [{ ImageUrl: 'https://webcams.kronplatz.com/webcam/kronplatz/30/webcam3.jpg' }],
  LicenseInfo: { License: 'CC0', ClosedData: false },
};

const speikbodenStream: OdhWebcam = {
  Id: '40ECA595-4F3C-3DB2-DBC1-C15A0A0EB4E8', Source: 'idm', Active: true, Shortname: 'Speikboden - Stream',
  GpsInfo: [{ Latitude: 0.0, Longitude: 0.0 }],
  Webcamurl: '', Streamurl: 'https://www.speikboden.it/webcam/aktuell/stream.mp4', ImageGallery: null,
  LicenseInfo: { License: '', ClosedData: false },
};

describe('mapWebcam', () => {
  it('maps a CC0 resort camera', () => {
    expect(mapWebcam(canazei)).toEqual({
      id: 'odh-DSS_11885478',
      lat: 46.476940647751,
      lng: 11.810216903687,
      name: 'Canazei - Alba di Canazei',
      city: 'Dolomites',
      country: 'Italy',
      feed_url: 'https://panodata.panomax.com/cams/1343/sassolungo_e_sella.jpg',
      source: 'Open Data Hub',
    });
  });

  it('drops rows not marked CC0, or marked closed', () => {
    expect(mapWebcam(unlicensed)).toBeNull();
    expect(mapWebcam({ ...canazei, LicenseInfo: { License: 'Closed', ClosedData: true } })).toBeNull();
    expect(mapWebcam({ ...canazei, LicenseInfo: { License: 'CC0', ClosedData: true } })).toBeNull();
    expect(mapWebcam({ ...canazei, LicenseInfo: null })).toBeNull();
  });

  it('leaves A22 to asfinag.ts and drops feratel media', () => {
    expect(mapWebcam(a22)).toBeNull();
    expect(mapWebcam(feratelThumb)).toBeNull();
  });

  it('drops inactive rows, missing coordinates, the fallback point and anything out of bounds', () => {
    expect(mapWebcam({ ...canazei, Active: false })).toBeNull();
    expect(mapWebcam({ ...canazei, GpsInfo: [] })).toBeNull();
    expect(mapWebcam({ ...canazei, GpsInfo: null })).toBeNull();
    expect(mapWebcam(fallbackPoint)).toBeNull();
    // Dolomiti Superski's other dump point, in Zürich.
    expect(mapWebcam({ ...canazei, GpsInfo: [{ Latitude: 47.3688387, Longitude: 8.53751490000002 }] })).toBeNull();
    expect(ODH_BOUNDS.minLat).toBeLessThan(46.476940647751);
  });

  it('drops plain-http stills the proxy does not serve', () => {
    const url = 'http://webcams.meran2000.com/ifinger/cam.jpg';
    expect(mapWebcam({ ...canazei, Webcamurl: url, ImageGallery: [{ ImageUrl: url }] })).toBeNull();
  });

  it('carries an mp4 stream as stream_url', () => {
    const cam = mapWebcam({
      ...speikbodenStream,
      GpsInfo: [{ Latitude: 46.9, Longitude: 11.9 }],
      LicenseInfo: { License: 'CC0', ClosedData: false },
    });
    expect(cam).toMatchObject({
      id: 'odh-40ECA595-4F3C-3DB2-DBC1-C15A0A0EB4E8',
      stream_url: 'https://www.speikboden.it/webcam/aktuell/stream.mp4',
      stream_type: 'mp4',
      city: 'South Tyrol',
    });
    expect(cam?.feed_url).toBeUndefined();
    expect(mapWebcam(speikbodenStream)).toBeNull();
  });
});

describe('collectWebcams', () => {
  it('keeps one camera per still and filters the rest', () => {
    const cams = collectWebcams([canazei, olangDss, olangIdm, unlicensed, a22, feratelThumb, fallbackPoint, canazei]);
    expect(cams.map(c => c.id)).toEqual(['odh-DSS_11885478', 'odh-DSS_6124']);
  });
});

// Live integration test — opt in with RUN_LIVE_TESTS=1.
const liveIt = process.env.RUN_LIVE_TESTS === '1' ? it : it.skip;

describe('fetchOpenDataHubCameras (live)', () => {
  liveIt('fetches the CC0 South Tyrol set', async () => {
    const cams = await fetchOpenDataHubCameras();
    expect(cams.length).toBeGreaterThan(60);
    expect(new Set(cams.map(c => c.id)).size).toBe(cams.length);
    for (const cam of cams) {
      expect(cam.id).toMatch(/^odh-/);
      expect(cam.feed_url ?? cam.stream_url).toMatch(/^https:\/\//);
      expect(cam.feed_url ?? '').not.toMatch(/feratel\.com|autobrennero\.it/);
    }
  }, 20000);
});
