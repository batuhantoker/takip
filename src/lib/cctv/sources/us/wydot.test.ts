import { afterEach, describe, it, expect, vi } from 'vitest';
import { mapWydotCamera, parseWydotStatewide, wydotSiteKey, fetchWydotCameras, WYDOT_BOUNDS } from './wydot';
import { WYDOT_SITES } from '@/lib/cctv/generated/wydot-sites.generated';

afterEach(() => vi.unstubAllGlobals());

// Verbatim rows from www.wyoroad.info/pls/Browse/WRR.Cameras, indentation collapsed.
const stateLine = '<tr> <td class="swroute">I25</td> <!-- Etichete accesibile adăugate în HTML (rezolvă Monsido 100%) --> <td class="swlocation"> <span class="mobile-label">Nearest Town: </span>Cheyenne </td> <td class="swdescription"> <span class="mobile-label">Web Camera Name: </span>Colorado State Line </td> <td class="swmilepost"> <span class="mobile-label">Milepost: </span>1.25 </td> <td class="swcamimages"> <div id="cameraimages"> <a href="/web-cam/cache?ref=VTJGc2RHVmtYMThEb2lWcTRGZ1FaZk11ZmVqSTN5SlROK0hYU1gvNC8xaDFWWTErcnNsbk1MMnBQclFONVpJeSthZG5maldDMVowSG9UTFVub0NHeFRYQUtvZGtCNVFmbXZCa0dXRDZIc2M9"  class="tooltip"  aria-labelledby="cam-VTJGc2RHVmtYMThEb2lWcTRGZ1FaZk11ZmVqSTN5SlROK0hYU1gvNC8xaDFWWTErcnNsbk1MMnBQclFONVpJeSthZG5maldDMVowSG9UTFVub0NHeFRYQUtvZGtCNVFmbXZCa0dXRDZIc2M9" title="View camera at I 25 Colorado State Line - South on I25"> <img src="/web-cam/cache?ref=VTJGc2RHVmtYMThEb2lWcTRGZ1FaZk11ZmVqSTN5SlROK0hYU1gvNC8xaDFWWTErcnNsbk1MMnBQclFONVpJeSthZG5maldDMVowSG9UTFVub0NHeFRYQUtvZGtCNVFmbXZCa0dXRDZIc2M9&thumb=true"  loading="lazy"  border="0"  width="150px"  height="auto"  alt=""  class="camera-img"> <br> <div id="cam-VTJGc2RHVmtYMThEb2lWcTRGZ1FaZk11ZmVqSTN5SlROK0hYU1gvNC8xaDFWWTErcnNsbk1MMnBQclFONVpJeSthZG5maldDMVowSG9UTFVub0NHeFRYQUtvZGtCNVFmbXZCa0dXRDZIc2M9"  class="caption"  style="color: #ffffff; font-size: 18px; font-weight: bold; background-color: #2B3E4A; margin-top: 0.5em;"> I 25 Colorado State Line - South </div> </a> <a href="/web-cam/cache?ref=VTJGc2RHVmtYMStPei9KTGxhUmY2OW15VTU2akMwc3B4TEZhc2Q3T01yT1NIUWJ5ZXNDVHJaOGcxM0NXM0RNWWc1Yi9JeENBcmZrc3p0WkxGSTVsc0J3Sm8xVVdNK09lblZXb2txUDM4eVE9"  class="tooltip"  aria-labelledby="cam-VTJGc2RHVmtYMStPei9KTGxhUmY2OW15VTU2akMwc3B4TEZhc2Q3T01yT1NIUWJ5ZXNDVHJaOGcxM0NXM0RNWWc1Yi9JeENBcmZrc3p0WkxGSTVsc0J3Sm8xVVdNK09lblZXb2txUDM4eVE9" title="View camera at I 25 Colorado State Line - North on I25"> <img src="/web-cam/cache?ref=VTJGc2RHVmtYMStPei9KTGxhUmY2OW15VTU2akMwc3B4TEZhc2Q3T01yT1NIUWJ5ZXNDVHJaOGcxM0NXM0RNWWc1Yi9JeENBcmZrc3p0WkxGSTVsc0J3Sm8xVVdNK09lblZXb2txUDM4eVE9&thumb=true"  loading="lazy"  border="0"  width="150px"  height="auto"  alt=""  class="camera-img"> <br> <div id="cam-VTJGc2RHVmtYMStPei9KTGxhUmY2OW15VTU2akMwc3B4TEZhc2Q3T01yT1NIUWJ5ZXNDVHJaOGcxM0NXM0RNWWc1Yi9JeENBcmZrc3p0WkxGSTVsc0J3Sm8xVVdNK09lblZXb2txUDM4eVE9"  class="caption"  style="color: #ffffff; font-size: 18px; font-weight: bold; background-color: #2B3E4A; margin-top: 0.5em;"> I 25 Colorado State Line - North </div> </a> <a href="/web-cam/cache?ref=VTJGc2RHVmtYMTg1RUpjREhQcDVDY2p6TldwVkRUZ0o5bGZYNnpWY0R1ZDNVMng4MkN2TWZ1bE5JeVVRTXdYZXdDa1BaQ1J2VkdnM2dVcTljN0FXY042eDEyd1dlQmt5SUxXNXp1T1N0Ylk9"  class="tooltip"  aria-labelledby="cam-VTJGc2RHVmtYMTg1RUpjREhQcDVDY2p6TldwVkRUZ0o5bGZYNnpWY0R1ZDNVMng4MkN2TWZ1bE5JeVVRTXdYZXdDa1BaQ1J2VkdnM2dVcTljN0FXY042eDEyd1dlQmt5SUxXNXp1T1N0Ylk9" title="View camera at I 25 Colorado State Line - Road Surface on I25"> <img src="/web-cam/cache?ref=VTJGc2RHVmtYMTg1RUpjREhQcDVDY2p6TldwVkRUZ0o5bGZYNnpWY0R1ZDNVMng4MkN2TWZ1bE5JeVVRTXdYZXdDa1BaQ1J2VkdnM2dVcTljN0FXY042eDEyd1dlQmt5SUxXNXp1T1N0Ylk9&thumb=true"  loading="lazy"  border="0"  width="150px"  height="auto"  alt=""  class="camera-img"> <br> <div id="cam-VTJGc2RHVmtYMTg1RUpjREhQcDVDY2p6TldwVkRUZ0o5bGZYNnpWY0R1ZDNVMng4MkN2TWZ1bE5JeVVRTXdYZXdDa1BaQ1J2VkdnM2dVcTljN0FXY042eDEyd1dlQmt5SUxXNXp1T1N0Ylk9"  class="caption"  style="color: #ffffff; font-size: 18px; font-weight: bold; background-color: #2B3E4A; margin-top: 0.5em;"> I 25 Colorado State Line - Road Surface </div> </a> </div> </td> </tr>';
const portOfEntry = '<tr> <td class="swroute">I25</td> <!-- Etichete accesibile adăugate în HTML (rezolvă Monsido 100%) --> <td class="swlocation"> <span class="mobile-label">Nearest Town: </span>Cheyenne </td> <td class="swdescription"> <span class="mobile-label">Web Camera Name: </span>Cheyenne South POE </td> <td class="swmilepost"> <span class="mobile-label">Milepost: </span>6.40 </td> <td class="swcamimages"> <div id="cameraimages"> <a href="/web-cam/cache?ref=VTJGc2RHVmtYMStCbXpCWlFad3VYQVRTeUZKb1JQQlN3OE80aWpMb1E4b2lFQmtyK09MRE1aWG9tMi8ya3hZYSt6bGNKa1ZKVmVnQ1M3K3NCSjVWa3U0TjUxb3E2d2Vvc2VDRytDLzUveFE9"  class="tooltip"  aria-labelledby="cam-VTJGc2RHVmtYMStCbXpCWlFad3VYQVRTeUZKb1JQQlN3OE80aWpMb1E4b2lFQmtyK09MRE1aWG9tMi8ya3hZYSt6bGNKa1ZKVmVnQ1M3K3NCSjVWa3U0TjUxb3E2d2Vvc2VDRytDLzUveFE9" title="View camera at I 25 Cheyenne Port of Entry on I25"> <img src="/web-cam/cache?ref=VTJGc2RHVmtYMStCbXpCWlFad3VYQVRTeUZKb1JQQlN3OE80aWpMb1E4b2lFQmtyK09MRE1aWG9tMi8ya3hZYSt6bGNKa1ZKVmVnQ1M3K3NCSjVWa3U0TjUxb3E2d2Vvc2VDRytDLzUveFE9&thumb=true"  loading="lazy"  border="0"  width="150px"  height="auto"  alt=""  class="camera-img"> <br> <div id="cam-VTJGc2RHVmtYMStCbXpCWlFad3VYQVRTeUZKb1JQQlN3OE80aWpMb1E4b2lFQmtyK09MRE1aWG9tMi8ya3hZYSt6bGNKa1ZKVmVnQ1M3K3NCSjVWa3U0TjUxb3E2d2Vvc2VDRytDLzUveFE9"  class="caption"  style="color: #ffffff; font-size: 18px; font-weight: bold; background-color: #2B3E4A; margin-top: 0.5em;"> I 25 Cheyenne Port of Entry </div> </a> </div> </td> </tr>';
// A concurrent route and refs padded with `&#x3D;`.
const lusk = '<tr> <td class="swroute">US18&#x2F;US20</td> <!-- Etichete accesibile adăugate în HTML (rezolvă Monsido 100%) --> <td class="swlocation"> <span class="mobile-label">Nearest Town: </span>Lusk </td> <td class="swdescription"> <span class="mobile-label">Web Camera Name: </span>Lusk </td> <td class="swmilepost"> <span class="mobile-label">Milepost: </span>37.60 </td> <td class="swcamimages"> <div id="cameraimages"> <a href="/web-cam/cache?ref=VTJGc2RHVmtYMStiS2MvSjhvYlFoc0Y0Z3JWZzNRTUcxTzk4VlVKcUlmdCtJR2RZSlhuSG9ENzZRUlNJcm1iazloMFRsNmRYZTFUMkpuREdIb2pGTGc9PQ&#x3D;&#x3D;"  class="tooltip"  aria-labelledby="cam-VTJGc2RHVmtYMStiS2MvSjhvYlFoc0Y0Z3JWZzNRTUcxTzk4VlVKcUlmdCtJR2RZSlhuSG9ENzZRUlNJcm1iazloMFRsNmRYZTFUMkpuREdIb2pGTGc9PQ&#x3D;&#x3D;" title="View camera at US 18&#x2F;20 Lusk - West on US18&#x2F;US20"> <img src="/web-cam/cache?ref=VTJGc2RHVmtYMStiS2MvSjhvYlFoc0Y0Z3JWZzNRTUcxTzk4VlVKcUlmdCtJR2RZSlhuSG9ENzZRUlNJcm1iazloMFRsNmRYZTFUMkpuREdIb2pGTGc9PQ&#x3D;&#x3D;&thumb=true"  loading="lazy"  border="0"  width="150px"  height="auto"  alt=""  class="camera-img"> <br> <div id="cam-VTJGc2RHVmtYMStiS2MvSjhvYlFoc0Y0Z3JWZzNRTUcxTzk4VlVKcUlmdCtJR2RZSlhuSG9ENzZRUlNJcm1iazloMFRsNmRYZTFUMkpuREdIb2pGTGc9PQ&#x3D;&#x3D;"  class="caption"  style="color: #ffffff; font-size: 18px; font-weight: bold; background-color: #2B3E4A; margin-top: 0.5em;"> US 18&#x2F;20 Lusk - West </div> </a> </div> </td> </tr>';
const page = (...rows: string[]) => `<html><body><table class="grid"><tbody>${rows.join(' ')}</tbody></table></body></html>`;

const site = { slug: 'I25COStateLine', lat: 41.01622, lng: -104.90392 };

describe('parseWydotStatewide', () => {
  it('reads route, town, name, milepost and every view of a site', () => {
    expect(parseWydotStatewide(page(stateLine))).toEqual([{
      route: 'I25',
      town: 'Cheyenne',
      name: 'Colorado State Line',
      milepost: '1.25',
      views: [
        { ref: 'VTJGc2RHVmtYMThEb2lWcTRGZ1FaZk11ZmVqSTN5SlROK0hYU1gvNC8xaDFWWTErcnNsbk1MMnBQclFONVpJeSthZG5maldDMVowSG9UTFVub0NHeFRYQUtvZGtCNVFmbXZCa0dXRDZIc2M9', caption: 'I 25 Colorado State Line - South' },
        { ref: 'VTJGc2RHVmtYMStPei9KTGxhUmY2OW15VTU2akMwc3B4TEZhc2Q3T01yT1NIUWJ5ZXNDVHJaOGcxM0NXM0RNWWc1Yi9JeENBcmZrc3p0WkxGSTVsc0J3Sm8xVVdNK09lblZXb2txUDM4eVE9', caption: 'I 25 Colorado State Line - North' },
        { ref: 'VTJGc2RHVmtYMTg1RUpjREhQcDVDY2p6TldwVkRUZ0o5bGZYNnpWY0R1ZDNVMng4MkN2TWZ1bE5JeVVRTXdYZXdDa1BaQ1J2VkdnM2dVcTljN0FXY042eDEyd1dlQmt5SUxXNXp1T1N0Ylk9', caption: 'I 25 Colorado State Line - Road Surface' },
      ],
    }]);
  });

  it('unescapes the route and the padded refs', () => {
    const [row] = parseWydotStatewide(page(lusk));
    expect(row.route).toBe('US18/US20');
    expect(row.views).toEqual([{ ref: 'VTJGc2RHVmtYMStiS2MvSjhvYlFoc0Y0Z3JWZzNRTUcxTzk4VlVKcUlmdCtJR2RZSlhuSG9ENzZRUlNJcm1iazloMFRsNmRYZTFUMkpuREdIb2pGTGc9PQ==', caption: 'US 18/20 Lusk - West' }]);
    expect(wydotSiteKey(row)).toBe('US18/US20|37.60');
  });

  it('finds every fixture site in the generated table', () => {
    for (const row of parseWydotStatewide(page(stateLine, portOfEntry, lusk))) expect(WYDOT_SITES[wydotSiteKey(row)]).toBeDefined();
  });
});

describe('mapWydotCamera', () => {
  const [row] = parseWydotStatewide(page(stateLine));

  it('maps a view to its still at the site', () => {
    expect(mapWydotCamera(row, row.views[0], site)).toEqual({
      id: 'wydot-i25costateline-south',
      lat: 41.01622,
      lng: -104.90392,
      name: 'I 25 Colorado State Line - South',
      city: 'Cheyenne',
      country: 'US',
      feed_url: 'https://www.wyoroad.info/web-cam/cache?ref=VTJGc2RHVmtYMThEb2lWcTRGZ1FaZk11ZmVqSTN5SlROK0hYU1gvNC8xaDFWWTErcnNsbk1MMnBQclFONVpJeSthZG5maldDMVowSG9UTFVub0NHeFRYQUtvZGtCNVFmbXZCa0dXRDZIc2M9',
      stream_type: 'jpg',
      external_url: 'https://www.wyoroad.info/highway/webcameras/view?site=I25COStateLine',
      source: 'WYDOT',
    });
  });

  it('keys each view by the site slug and its caption suffix', () => {
    expect(row.views.map(v => mapWydotCamera(row, v, site)?.id)).toEqual([
      'wydot-i25costateline-south', 'wydot-i25costateline-north', 'wydot-i25costateline-road-surface',
    ]);
    const [poe] = parseWydotStatewide(page(portOfEntry));
    expect(mapWydotCamera(poe, poe.views[0], { slug: 'I25CheyennePOE', lat: 41.07911, lng: -104.85633 })?.id).toBe('wydot-i25cheyennepoe');
  });

  it('drops a view without a site, a malformed ref or a position outside Wyoming', () => {
    expect(mapWydotCamera(row, row.views[0], undefined)).toBeNull();
    expect(mapWydotCamera(row, { ...row.views[0], ref: 'abc"><script>' }, site)).toBeNull();
    expect(mapWydotCamera(row, { ...row.views[0], ref: '' }, site)).toBeNull();
    expect(mapWydotCamera(row, row.views[0], { ...site, lat: 0, lng: 0 })).toBeNull();
    expect(mapWydotCamera(row, row.views[0], { ...site, lat: 40.5 })).toBeNull();
    expect(mapWydotCamera(null, row.views[0], site)).toBeNull();
  });

  it('falls back when the caption or town is missing', () => {
    const cam = mapWydotCamera({ ...row, town: '' }, { ...row.views[0], caption: '' }, site);
    expect(cam?.name).toBe('I25 Colorado State Line');
    expect(cam?.city).toBe('Wyoming');
    expect(cam?.id).toBe('wydot-i25costateline');
  });
});

describe('fetchWydotCameras', () => {
  it('throws on an HTTP error, a page without sites or a short read', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 503 })));
    await expect(fetchWydotCameras()).rejects.toThrow('HTTP 503');
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<html>maintenance</html>')));
    await expect(fetchWydotCameras()).rejects.toThrow('0 sites');
    vi.stubGlobal('fetch', vi.fn(async () => new Response(page(...Array(200).fill(stateLine)))));
    await expect(fetchWydotCameras()).rejects.toThrow('short read: 3');
  });
});

const liveIt = process.env.RUN_LIVE_TESTS === '1' ? it : it.skip;

liveIt('fetches a large set of well-formed WYDOT cameras', async () => {
  const cams = await fetchWydotCameras();
  expect(cams.length).toBeGreaterThan(600);
  expect(new Set(cams.map(c => c.id)).size).toBe(cams.length);
  const b = WYDOT_BOUNDS;
  for (const c of cams) {
    expect(c.id).toMatch(/^wydot-[a-z0-9]+(-[a-z0-9-]+)?$/);
    expect(c.source).toBe('WYDOT');
    expect(c.feed_url).toMatch(/^https:\/\/www\.wyoroad\.info\/web-cam\/cache\?ref=[A-Za-z0-9+/]+=*$/);
    expect(c.lat > b.minLat && c.lat < b.maxLat && c.lng > b.minLng && c.lng < b.maxLng).toBe(true);
  }
  const still = await fetch(`${cams[0].feed_url}&_t=1`, { headers: { 'User-Agent': 'TAKIP/0.1 (+https://github.com/batuhantoker/takip)' } });
  expect(still.headers.get('content-type')).toBe('image/jpeg');
}, 20_000);
