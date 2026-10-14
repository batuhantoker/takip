import { stealthFetch } from '@/lib/stealthFetch';
import { fetchAsfinagCameras } from '@/lib/cctv/sources/europe/asfinag';
import { fetchNetherlandsCameras } from '@/lib/cctv/sources/europe/netherlands';

// ═══ CAMERA SOURCE DEFINITIONS ═══

// ── UK: Transport for London JamCams (~900) ──
export async function fetchTfLCameras(): Promise<any[]> {
  try {
    const res = await stealthFetch('https://api.tfl.gov.uk/Place/Type/JamCam', { signal: AbortSignal.timeout(12000) });
    if (!res.ok) return [];
    const data = await res.json();
    return (data || []).map((cam: any) => {
      const imgProp = cam.additionalProperties?.find((p: any) => p.key === 'imageUrl');
      const camId = cam.id?.replace('JamCams_', '') || '';
      return {
        id: `tfl-${cam.id}`, lat: cam.lat, lng: cam.lon,
        name: cam.commonName || 'London JamCam', city: 'London', country: 'UK',
        feed_url: imgProp?.value || `https://s3-eu-west-1.amazonaws.com/jamcams.tfl.gov.uk/${camId}.jpg`,
        source: 'TfL',
      };
    }).filter((c: any) => c.lat && c.lng);
  } catch (e) { return []; }
}

/**
 * One sub-source of a multi-source region, fetched with a single retry.
 *
 * These blocks swallowed every failure. A region returns whatever it managed
 * to collect, and sourceCache stores a non-empty result as a success — so one
 * blip on one source cached the region without it for the full TTL, with
 * nothing in the log to say which one went missing. Quebec disappeared from
 * Canada that way for half an hour while its own endpoint was answering in
 * 300ms. The retry catches the blip; the warning means a real outage is
 * visible instead of silent.
 */
async function subSource(label: string, url: string, timeoutMs: number) {
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const res = await stealthFetch(url, { signal: AbortSignal.timeout(timeoutMs) });
      if (res.ok) return await res.json();
      /* A 4xx is a decision, not a blip: a retired endpoint answers 404 just
         as fast the second time. Retrying them only spent the region's budget
         — Montreal (403) and Alberta (400) between them pushed Canada past
         12s, so the whole country came back empty on a cold cache. */
      if (res.status >= 400 && res.status < 500) {
        console.warn(`[TAKIP] ${label} returned ${res.status} — absent from this refresh, not retried`);
        return null;
      }
      if (attempt === 2) console.warn(`[TAKIP] ${label} returned ${res.status} — absent from this refresh`);
    } catch (e) {
      if (attempt === 2) console.warn(`[TAKIP] ${label} failed — absent from this refresh:`, e instanceof Error ? e.message : e);
    }
  }
  return null;
}

// ── CANADA: Ottawa, Toronto, Quebec, BC ──
export async function fetchCanadaCameras(): Promise<any[]> {
  const cams: any[] = [];

  /* All four run at once. Awaited one after another their timeouts summed
     to well over the 12s the route allows a region, so Canada kept coming
     back empty and only filled in on a later poll — the whole country
     looked like it was failing to load. They share nothing, so there was
     never a reason to queue them. */
  const [ottawa, quebec, toronto, drivebc] = await Promise.all([
    subSource('City of Ottawa', 'https://traffic.ottawa.ca/beta/camera_list', 12000),
    subSource('Quebec 511', 'https://ws.mapserver.transports.gouv.qc.ca/swtq?service=wfs&version=2.0.0&request=getfeature&typename=ms:infos_cameras&outfile=Camera&srsname=EPSG:4326&outputformat=geojson', 10000),
    subSource('City of Toronto', 'https://ckan0.cf.opendata.inter.prod-toronto.ca/dataset/a3309088-5fd4-4d34-8297-77c8301840ac/resource/4a568300-c7f8-496d-b150-dff6f5dc6d4f/download/traffic-camera-list-4326.geojson', 10000),
    subSource('DriveBC', 'https://www.drivebc.ca/api/webcams/', 10000),
  ]);


  // Ottawa Municipal Cameras (Comprehensive)
  {
    const data = ottawa;
    if (data) {
      for (const cam of (data || [])) {
        if (!cam.latitude || !cam.longitude) continue;
        // MTO's own cameras, minutes staler than 511 Ontario's copy of them.
        if (/^\(MTO\)/i.test(cam.description ?? '')) continue;
        cams.push({
          id: `ottawa-muni-${cam.id}`, lat: cam.latitude, lng: cam.longitude,
          name: cam.description || 'Ottawa Traffic Camera', city: 'Ottawa', country: 'Canada',
          feed_url: `https://traffic.ottawa.ca/map/camera?id=${cam.number || cam.id}`, source: 'City of Ottawa',
        });
      }
    }
  }

  // Quebec 511 (Comprehensive - covers Montreal, Quebec City, highways)
  {
    const data = quebec;
    if (data) {
      for (const feature of (data.features || [])) {
        const coords = feature.geometry?.coordinates;
        const p = feature.properties;
        if (!coords || !p || !p.IDEcamera) continue;
        
        cams.push({
          id: `quebec511-${p.IDEcamera}`, lat: coords[1], lng: coords[0],
          name: p.DescriptionLocalisationEn || p.DescriptionLocalisationFr || 'Quebec 511 Camera', city: p.NomRegionDiffusion || 'Quebec', country: 'Canada',
          stream_url: p.URL_FLUX_DONNEE ? p.URL_FLUX_DONNEE.replace('FenetreVideo.html', 'camera.ashx') + '&format=mp4' : `https://www.quebec511.info/Carte/Fenetres/camera.ashx?id=${p.IDEcamera}&format=mp4`,
          stream_type: 'mp4',
          source: 'Quebec 511',
        });
      }
    }
  }

  /* 511 Ontario and 511 Alberta load as their own regions (platforms/us-511). Ville de Montréal's own feed is
     retired: it redirects to Québec 511, which covers Montréal. */

  // Toronto Open Data Municipal Traffic Cameras
  {
    const data = toronto;
    if (data) {
      for (const feature of (data.features || [])) {
        let coords = feature.geometry?.coordinates;
        if (Array.isArray(coords) && Array.isArray(coords[0])) coords = coords[0];
        const p = feature.properties;
        if (!coords || !p || !p.IMAGEURL) continue;
        cams.push({
          id: `tor-open-${p.REC_ID}`, lat: coords[1], lng: coords[0],
          name: `${p.MAINROAD} / ${p.CROSSROAD}`, city: 'Toronto', country: 'Canada',
          feed_url: p.IMAGEURL, source: 'City of Toronto',
        });
      }
    }
  }

  // British Columbia HighwayCams (Live JSON API)
  {
    const data = drivebc;
    if (data) {
      for (const cam of (data || [])) {
        if (!cam.location?.coordinates || !cam.links?.imageDisplay) continue;
        const [lng, lat] = cam.location.coordinates;
        cams.push({
          id: `bc-cam-${cam.id}`, lat, lng,
          name: cam.name || cam.caption || 'BC Highway Camera', city: 'British Columbia', country: 'Canada',
          feed_url: `https://www.drivebc.ca${cam.links.imageDisplay}`, source: 'DriveBC',
        });
      }
    }
  }

  return cams.filter((c: any) => c.lat && c.lng);
}

// ── US-EAST: OH, DC, Florida, Georgia ──
export async function fetchUSEastCameras(): Promise<any[]> {
  const cams: any[] = [];

  // Butler County, OH (from redhunt45 fork)
  cams.push(
    {
      id: 'butler-oh-hamilton', lat: 39.3988617, lng: -84.5595353,
      name: 'Hamilton, OH', city: 'Hamilton', country: 'US',
      feed_url: 'https://gsccam.butlersheriff.org/axis-cgi/jpg/image.cgi',
      external_url: 'https://gsccam.butlersheriff.org/camera/index.html#/video',
      source: 'Butler County, OH',
    },
    {
      id: 'butler-oh-129-747', lat: 39.381435, lng: -84.438423,
      name: 'OH-129 at 747', city: 'Butler County', country: 'US',
      feed_url: 'https://towercam.butlersheriff.org/axis-cgi/jpg/image.cgi',
      external_url: 'https://towercam.butlersheriff.org/aca/index.html#view',
      source: 'Butler County, OH',
    },
  );

  // Cincinnati, OH (from redhunt45 fork)
  cams.push(
    {
      id: 'cincinnati-cincyvision-yt', lat: 39.089101, lng: -84.527943,
      name: 'CincyVision YT', city: 'Cincinnati', country: 'US',
      external_url: 'https://www.youtube.com/@AaronPreslin/live',
      source: 'Cincinnati, OH',
    },
    {
      id: 'cincinnati-covington-earthcam', lat: 39.090510, lng: -84.510413,
      name: 'Roebling Bridge (EarthCam)', city: 'Covington', country: 'US',
      // The share player the Roebling Bridge Society embeds; same camera as earthcam.com's ?cam=covington.
      stream_url: 'https://share.earthcam.net/public/tJ90CoLmq7TzrY396Yd88LttZYtaTRUn2sGCVbI_5lI/covington_bridge/camera',
      stream_type: 'iframe',
      external_url: 'https://roeblingbridge.org/Home/Bridge-Webcam',
      source: 'Cincinnati, OH',
    },
  );
  /* Florida used to be fetched here from fl511.com/api/v2/cameras. That
     endpoint has returned 404 for some time — and because the block tested
     `res.ok` before doing anything, it failed without even reaching a catch.
     ./florida now serves the state from the working IBI index; this is left
     out rather than kept as a source that can only ever contribute nothing. */


  return cams.filter((c: any) => c.lat && c.lng);
}

// ── EUROPE: Netherlands, Germany, France ──
export async function fetchEuropeCameras(): Promise<any[]> {
  const cams: any[] = [];

  /* The Netherlands used to be fetched here from opendata.ndw.nu/cameras.json.
     NDW retired that dataset and it 404s; ./netherlands now serves the country
     from the Rijkswaterstaat feed, which is still published. */
  try {
    cams.push(...await fetchNetherlandsCameras());
  } catch (e) {
    console.warn('[TAKIP] Netherlands cameras failed — absent from this refresh:', e instanceof Error ? e.message : e);
  }

  cams.push(...await fetchAsfinagCameras());

  return cams.filter((c: any) => c.lat && c.lng);
}

// ── ASIA/PACIFIC ──
export async function fetchAsiaCameras(): Promise<any[]> {
  const cams: any[] = [];

  // Singapore Live Traffic Images
  {
    const data = await subSource('LTA Singapore', 'https://api.data.gov.sg/v1/transport/traffic-images', 10000);
    if (data) {
      const items = data.items?.[0]?.cameras || [];
      for (const cam of items) {
        if (!cam.location?.latitude || !cam.location?.longitude || !cam.image) continue;
        cams.push({
          id: `sin-${cam.camera_id}`,
          lat: cam.location.latitude,
          lng: cam.location.longitude,
          name: `Camera ${cam.camera_id}`,
          city: 'Singapore',
          country: 'Singapore',
          feed_url: cam.image,
          source: 'LTA Singapore'
        });
      }
    }
  }

  return cams;
}


// ── MIDDLE EAST: Israel, Lebanon ──
export async function fetchMiddleEastCameras(): Promise<any[]> {
  const cams: any[] = [];
  
  // Israel Curated (Embedded)
  cams.push(
    {
      id: 'il-israel-multicam', lat: 32.0853, lng: 34.7818,
      name: 'Israel Multi-Cam (Live)', city: 'Tel Aviv', country: 'Israel',
      stream_url: 'https://www.youtube.com/embed/gmtlJ_m2r5A?autoplay=1&mute=1',
      stream_type: 'iframe',
      source: 'YouTube Live',
    },
    {
      id: 'il-jerusalem-live', lat: 31.7767, lng: 35.2345,
      name: 'Jerusalem Western Wall', city: 'Jerusalem', country: 'Israel',
      stream_url: 'https://www.youtube.com/embed/77akujLn4k8?autoplay=1&mute=1',
      stream_type: 'iframe',
      source: 'YouTube Live',
    }
  );

  // Lebanon Curated (Embedded)
  cams.push(
    {
      id: 'lb-beirut-skyline', lat: 33.8938, lng: 35.5018,
      name: 'Beirut Skyline Live', city: 'Beirut', country: 'Lebanon',
      stream_url: 'https://www.youtube.com/embed/qJf4NqPKLjI?autoplay=1&mute=1',
      stream_type: 'iframe',
      source: 'YouTube Live',
    },
    {
      id: 'lb-me-multicam', lat: 33.2721, lng: 35.2033,
      name: 'Middle East Multi-Cam (Live)', city: 'Regional', country: 'Middle East',
      stream_url: 'https://www.youtube.com/embed/oxT5R6I0N6E?autoplay=1&mute=1',
      stream_type: 'iframe',
      source: 'YouTube Live',
    }
  );

  return cams;
}
