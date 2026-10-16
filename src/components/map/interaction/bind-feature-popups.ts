import type * as maplibregl from 'maplibre-gl';
import {
  balloonPopupHtml, chokepointPopupHtml, conflictPopupHtml,
  earthquakePopupHtml, firePopupHtml, gdeltEventPopupHtml, incidentPopupHtml,
  nuclearPopupHtml, portPopupHtml, radiationPopupHtml,
  sdkLinkPopupHtml, weatherEventPopupHtml,
  temperaturePointPopupHtml,
  weatherPointPopupHtml,
} from '@/lib/map/popups/layer-popups';
import {
  attackOriginPopupHtml, c2ServerPopupHtml, malwarePopupHtml, outagePopupHtml,
  scanTargetPopupHtml, supplierPopupHtml, sweepDevicePopupHtml,
} from '@/lib/map/popups/cyber-popups';
import { bindCctvClusterClicks } from '@/lib/feeds/cameras/map-layers';
import { launchPopupHtml } from '@/lib/space/globe/launch-popup';
import { serviceStatusPopupHtml } from '@/lib/feeds/hazards/service-status-popup';
import { gnssPopupHtml } from '@/lib/feeds/hazards/gnss-popup';
import { warAlertPopupHtml } from '@/lib/feeds/hazards/war-alerts';
import { fireIncidentPopupHtml } from '@/lib/feeds/hazards/fire-incidents';
import { FIRE_PERIMETER_FILL, firePerimeterPopupHtml } from '@/lib/feeds/hazards/fire-perimeters';
import { NHC_CONE, NHC_POINTS, nhcConePopupHtml, nhcPointPopupHtml } from '@/lib/feeds/hazards/nhc-forecast';
import { airportDelayPopupHtml } from '@/lib/feeds/aviation/airport-delays';
import { alprPopupHtml, isAlprCamera } from '@/lib/feeds/cameras/alpr-describe';
import { ALPR_DETAIL_ZOOM, ALPR_PICK_LAYERS } from '@/lib/feeds/cameras/alpr-layers';
import { AIRPORT_WX_PICK, SIGMET_PICK } from '@/lib/feeds/aviation-weather/layers';
import { flowPopupHtml, trafficPopupHtml } from '@/lib/feeds/traffic/describe';
import { TRAFFIC_FLOW_LAYER, TRAFFIC_LAYER } from '@/lib/feeds/traffic/map-layers';
import { airportWxPopupHtml, sigmetPopupHtml } from '@/lib/feeds/aviation-weather/popups';
import { nearestClickable } from '@/lib/map/clickable-layers';
import { chokepointFlowPopupHtml } from '@/lib/feeds/maritime/chokepoint-flow';
import { outbreakPopupHtml } from '@/lib/feeds/hazards/outbreaks';
import { TRANSIT_CITY_LAYER, TRANSIT_PICK_LAYERS } from '@/lib/feeds/transit/map-layers';
import { TRANSIT_MIN_ZOOM } from '@/lib/feeds/transit/view';
import type { CameraInfo, InspectSink, TransitTarget } from '@/components/map/inspect/types';
import type { ShowPopup, WorldMapProps } from '@/components/map/types';

export function bindCctvAndQuakeClicks(map: maplibregl.Map, popup: ShowPopup, onEntityClick: WorldMapProps['onEntityClick'], sink: InspectSink) {
  bindCctvClusterClicks(map);
  // A camera opens the inspect card and the floating player together.
  map.on('click', 'cctv-dots', e => {
    if (!e.features?.length) return;
    const p = e.features[0].properties as any;
    const coords = (e.features[0].geometry as any).coordinates;
    const camera: CameraInfo = {
      id: String(p.id ?? `${coords[0]},${coords[1]}`),
      name: p.name,
      city: p.city,
      country: p.country,
      source: p.source,
      feed_url: p.feed_url,
      stream_url: p.stream_url,
      stream_type: p.stream_type,
      external_url: p.external_url,
      road: p.road,
      offline: p.offline === true,
      lat: coords[1],
      lng: coords[0],
    };
    if (!sink.open({ kind: 'camera', id: camera.id, camera })) return;
    onEntityClick?.({ type: 'cctv', ...camera });
    map.flyTo({ center: coords, zoom: Math.max(map.getZoom(), 13), duration: 1000 });
  });

  // ── Earthquakes (with USGS link) ──
  map.on('click', 'eq-circles', e => {
    if (!e.features?.length) return;
    const p = e.features[0].properties as any;
    const coords = (e.features[0].geometry as any).coordinates;
    popup(coords, earthquakePopupHtml(p, coords));
  });
}

export function bindFeaturePopups(map: maplibregl.Map, popup: ShowPopup, onEntityClick: WorldMapProps['onEntityClick'], sink: InspectSink) {
  // ── Fires (with NASA FIRMS link) ──
  map.on('click', 'fires-heat', e => {
    if (!e.features?.length) return;
    const p = e.features[0].properties as any;
    const coords = (e.features[0].geometry as any).coordinates;
    popup(coords, firePopupHtml(p, coords));
  });

  // ── Malware Threats (Abuse.ch) ──
  map.on('click', 'malware-dots', e => {
    if (!e.features?.length) return;
    const p = e.features[0].properties as any;
    const coords = (e.features[0].geometry as any).coordinates;
    popup(coords, malwarePopupHtml(p));
  });


  // ── GDELT 2.0 Events ──
  map.on('click', 'gdelt-events-dots', e => {
    if (!e.features?.length) return;
    const p = e.features[0].properties as any;
    const coords = (e.features[0].geometry as any).coordinates;
    popup(coords, gdeltEventPopupHtml(p));
  });

  // ── Cloudflare Radar: internet outage ──
  map.on('click', 'cf-outage-dots', e => {
    if (!e.features?.length) return;
    const p = e.features[0].properties as any;
    const coords = (e.features[0].geometry as any).coordinates;
    popup(coords, outagePopupHtml(p));
  });

  // ── Cloudflare Radar: attack origin share ──
  map.on('click', 'cf-attack-dots', e => {
    if (!e.features?.length) return;
    const p = e.features[0].properties as any;
    const coords = (e.features[0].geometry as any).coordinates;
    popup(coords, attackOriginPopupHtml(p));
  });

  // ── Likely GNSS interference (the cell, popped at its centre) ──
  map.on('click', 'gnss-fill', e => {
    const p = e.features?.[0]?.properties;
    if (!p) return;
    popup([Number(p.lng), Number(p.lat)], gnssPopupHtml(p));
  });

  // ── Vendor status-page incidents ──
  map.on('click', 'service-status-dots', e => {
    const f = e.features?.[0];
    if (!f || f.geometry.type !== 'Point') return;
    popup(f.geometry.coordinates, serviceStatusPopupHtml(f.properties ?? {}));
  });

  // ── GDELT Conflicts (with source article) ──
  map.on('click', 'gdelt-dots', e => {
    if (!e.features?.length) return;
    const p = e.features[0].properties as any;
    const coords = (e.features[0].geometry as any).coordinates;
    popup(coords, incidentPopupHtml(p));
  });

  // ── Global Event / Conflict Markers ──
  map.on('click', 'conflict-icons', e => {
    if (!e.features?.length) return;
    const p = e.features[0].properties as any;
    const coords = (e.features[0].geometry as any).coordinates;
    popup(coords, conflictPopupHtml(p, coords));
  });


  // ── TAKIP SDK link click ──
  ['sdk-sea','sdk-sea-glow','sdk-air','sdk-air-glow','sdk-intel','sdk-intel-glow'].forEach(layer => {
    map.on('click', layer, e => {
      if (!e.features?.length) return;
      const p = e.features[0].properties as any;
      const coords = e.lngLat;
      popup([coords.lng, coords.lat], sdkLinkPopupHtml(p));
    });
  });

  map.on('click', 'cyber-heads', e => {
    if (!e.features?.length) return;
    const p = e.features[0].properties as any;
    const coords = (e.features[0].geometry as any).coordinates;
    popup(coords, c2ServerPopupHtml(p));
  });

  // ── Generic hover for clickables ──
  ['conflict-icons','cctv-dots','cctv-clusters','eq-circles','fires-heat','gdelt-dots','weather-dots','infra-dots','maritime-dots','choke-dots','news-dots','balloon-dots','launch-dots','rad-dots','war-alert-dots','fire-incident-dots',FIRE_PERIMETER_FILL,NHC_POINTS,NHC_CONE,'airport-delay-dots','chokepoint-flow-ring','outbreak-rings','ship-dots','ship-arrows',...TRANSIT_PICK_LAYERS,TRANSIT_CITY_LAYER,'sweep-device-dots','scan-targets-dots','sdk-sea','sdk-air','sdk-intel','malware-dots','cyber-heads','gdelt-events-dots','cf-outage-dots','cf-attack-dots','service-status-dots','gnss-fill','alert-pin-dots','wx-wind','wx-temp-label',...ALPR_PICK_LAYERS,TRAFFIC_LAYER,TRAFFIC_FLOW_LAYER].forEach(layer => {
    map.on('mouseenter', layer, () => { map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', layer, () => { map.getCanvas().style.cursor = ''; });
  });

  // ── Scan Targets click ──
  map.on('click', 'scan-targets-dots', (e: any) => {
    const p = e.features?.[0]?.properties;
    if (!p) return;
    const coords = e.features[0].geometry.coordinates.slice();
    popup(coords, scanTargetPopupHtml(p, coords));
  });

  // ── SCM Suppliers ──
  map.on('click', 'scm-dots', e => {
    if (!e.features?.length) return;
    const p = e.features[0].properties as any;
    const coords = (e.features[0].geometry as any).coordinates;
    popup(coords, supplierPopupHtml(p));
  });

  // ── IP Sweep device click ──
  map.on('click', 'sweep-device-dots', (e: any) => {
    const p = e.features?.[0]?.properties;
    if (!p) return;
    const coords = e.features[0].geometry.coordinates.slice();
    popup(coords, sweepDevicePopupHtml(p));
  });

  // ── Upcoming launches (Launch Library 2) ──
  map.on('click', 'launch-dots', e => {
    const f = e.features?.[0];
    if (!f || f.geometry.type !== 'Point') return;
    popup(f.geometry.coordinates, launchPopupHtml(f.properties ?? {}));
  });

  // ── Balloons / Sondes ──
  map.on('click', 'balloon-dots', e => {
    if (!e.features?.length) return;
    const p = e.features[0].properties as any;
    const coords = (e.features[0].geometry as any).coordinates;
    popup(coords, balloonPopupHtml(p));
  });

  // ── Radiation ──
  map.on('click', 'rad-dots', e => {
    if (!e.features?.length) return;
    const p = e.features[0].properties as any;
    const coords = (e.features[0].geometry as any).coordinates;
    popup(coords, radiationPopupHtml(p));
  });

  // ── War and air-raid alerts ──
  map.on('click', 'war-alert-dots', e => {
    const f = e.features?.[0];
    if (!f || f.geometry.type !== 'Point') return;
    popup(f.geometry.coordinates, warAlertPopupHtml(f.properties ?? {}));
  });

  // ── NHC forecast points and cones ──
  map.on('click', NHC_POINTS, e => {
    const f = e.features?.[0];
    if (!f || f.geometry.type !== 'Point') return;
    popup(f.geometry.coordinates, nhcPointPopupHtml(f.properties ?? {}));
  });
  map.on('click', NHC_CONE, e => {
    const p = e.features?.[0]?.properties;
    if (!p || nearestClickable(map, e.point, 4)) return;
    popup([e.lngLat.lng, e.lngLat.lat], nhcConePopupHtml(p));
  });

  // ── Agency-mapped US wildfire perimeters (NIFC WFIGS) ──
  map.on('click', FIRE_PERIMETER_FILL, e => {
    const p = e.features?.[0]?.properties;
    // A hotspot or incident drawn over the perimeter is what was clicked; its own handler answers.
    if (!p || nearestClickable(map, e.point, 4)) return;
    popup([e.lngLat.lng, e.lngLat.lat], firePerimeterPopupHtml(p));
  });

  // ── Agency-reported wildfires (CWFIS) ──
  map.on('click', 'fire-incident-dots', e => {
    const f = e.features?.[0];
    if (!f || f.geometry.type !== 'Point') return;
    popup(f.geometry.coordinates, fireIncidentPopupHtml(f.properties ?? {}));
  });

  // ── FAA airport delays ──
  map.on('click', 'airport-delay-dots', e => {
    const f = e.features?.[0];
    if (!f || f.geometry.type !== 'Point') return;
    popup(f.geometry.coordinates, airportDelayPopupHtml(f.properties ?? {}));
  });

  // ── Licence-plate readers; the density tiles below z9 carry no details, so a click there zooms in ──
  map.on('click', ALPR_PICK_LAYERS, e => {
    const f = e.features?.[0];
    if (!f || f.geometry.type !== 'Point') return;
    const coords = f.geometry.coordinates as [number, number];
    if (isAlprCamera(f.properties ?? {})) popup(coords, alprPopupHtml(f.properties ?? {}));
    else map.easeTo({ center: coords, zoom: Math.max(map.getZoom() + 3, ALPR_DETAIL_ZOOM + 3), duration: 900 });
  });

  // ── Measured road traffic ──
  map.on('click', TRAFFIC_LAYER, e => {
    const f = e.features?.[0];
    if (f) popup(e.lngLat, trafficPopupHtml(f.properties ?? {}));
  });
  map.on('click', TRAFFIC_FLOW_LAYER, e => {
    const f = e.features?.[0];
    if (f) popup(e.lngLat, flowPopupHtml(f.properties ?? {}));
  });

  // ── Airport weather (METAR) and SIGMET hazard areas ──
  map.on('click', AIRPORT_WX_PICK, e => {
    const f = e.features?.[0];
    if (!f || f.geometry.type !== 'Point') return;
    popup(f.geometry.coordinates, airportWxPopupHtml(f.properties ?? {}));
  });
  map.on('click', SIGMET_PICK, e => {
    const p = e.features?.[0]?.properties;
    // A marker drawn over the area is what was clicked; its own handler answers.
    if (!p || nearestClickable(map, e.point, 4)) return;
    popup([e.lngLat.lng, e.lngLat.lat], sigmetPopupHtml(p));
  });
  for (const layer of [AIRPORT_WX_PICK, SIGMET_PICK]) {
    map.on('mouseenter', layer, () => { map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', layer, () => { map.getCanvas().style.cursor = ''; });
  }

  // ── PortWatch chokepoint traffic ──
  map.on('click', 'chokepoint-flow-ring', e => {
    const f = e.features?.[0];
    if (!f || f.geometry.type !== 'Point') return;
    popup(f.geometry.coordinates, chokepointFlowPopupHtml(f.properties ?? {}));
  });

  // ── Disease outbreak notices ──
  map.on('click', 'outbreak-rings', e => {
    const f = e.features?.[0];
    if (!f || f.geometry.type !== 'Point') return;
    popup(f.geometry.coordinates, outbreakPopupHtml(f.properties ?? {}));
  });

  // ── Weather grid point (Open-Meteo) ──
  map.on('click', 'wx-wind', e => {
    const feature = e.features?.[0];
    if (!feature) return;
    const p = feature.properties as Record<string, unknown>;
    const coords = (feature.geometry as GeoJSON.Point).coordinates;
    popup(coords, weatherPointPopupHtml(p, coords));
  });

  // ── Temperature reading ──
  map.on('click', 'wx-temp-label', e => {
    const feature = e.features?.[0];
    if (!feature) return;
    const coords = (feature.geometry as GeoJSON.Point).coordinates;
    popup(coords, temperaturePointPopupHtml(feature.properties as Record<string, unknown>, coords));
  });

  // ── Maritime Ships ──
  map.on('click', ['ship-dots', 'ship-arrows'], e => {
    if (!e.features?.length) return;
    const p = e.features[0].properties as any;
    const [lng, lat] = (e.features[0].geometry as any).coordinates;
    const mmsi = String(p.mmsi ?? '');
    if (!mmsi) return;
    sink.open({
      kind: 'ship', id: mmsi, mmsi, name: p.name, type: p.type, lng, lat,
      speed: p.speed ?? undefined, heading: p.heading ?? undefined, destination: p.destination ?? undefined, flag: p.flag ?? undefined,
    });
  });

  // ── Public transit: a vehicle opens its window; a city flies in to where its vehicles show ──
  map.on('click', TRANSIT_PICK_LAYERS, e => {
    const f = e.features?.[0];
    const p = f?.properties as Record<string, unknown> | undefined;
    if (!f || !p?.key) return;
    const [lng, lat] = (f.geometry as GeoJSON.Point).coordinates;
    const n = (v: unknown) => (v == null || v === '' ? undefined : Number(v));
    const s = (v: unknown) => (v == null || v === '' ? undefined : String(v));
    sink.open({
      kind: 'transit', id: String(p.key), lng, lat,
      route: s(p.route), trip: s(p.trip), label: s(p.label), plate: s(p.plate), operator: s(p.operator), feed: s(p.feed), license: s(p.license),
      bearing: n(p.bearing), speed: n(p.speed), status: n(p.status), age: n(p.age),
      mode: s(p.mode) as TransitTarget['mode'], stop: s(p.stop), from: s(p.from), estimated: String(p.estimated) === 'true' || undefined, scheduled: String(p.scheduled) === 'true' || undefined,
    });
  });
  map.on('click', TRANSIT_CITY_LAYER, e => {
    const f = e.features?.[0];
    if (!f) return;
    map.flyTo({ center: (f.geometry as GeoJSON.Point).coordinates as [number, number], zoom: TRANSIT_MIN_ZOOM + 1.5, duration: 1600, essential: true });
  });

  // ── Weather Events (NASA EONET + NOAA/NWS + GDACS) ──
  map.on('click', 'weather-dots', e => {
    if (!e.features?.length) return;
    const p = e.features[0].properties as any;
    const coords = (e.features[0].geometry as any).coordinates;
    popup(coords, weatherEventPopupHtml(p, coords));
  });

  // ── Nuclear Infrastructure ──
  map.on('click', 'infra-dots', e => {
    if (!e.features?.length) return;
    const p = e.features[0].properties as any;
    const coords = (e.features[0].geometry as any).coordinates;
    popup(coords, nuclearPopupHtml(p, coords));
  });

  // ── Maritime Ports & Naval Bases ──
  map.on('click', 'maritime-dots', e => {
    const p = e.features?.[0]?.properties;
    if (!p) return;
    const coords = (e.features![0].geometry as any).coordinates;
    popup(coords, portPopupHtml(p));
  });

  // ── Maritime Chokepoints ──
  map.on('click', 'choke-dots', e => {
    const p = e.features?.[0]?.properties;
    if (!p) return;
    const coords = (e.features![0].geometry as any).coordinates;
    popup(coords, chokepointPopupHtml(p));
  });

  // ── Live News (opens feed viewer) ──
  map.on('click', 'news-dots', e => {
    const p = e.features?.[0]?.properties;
    if (!p) return;
    onEntityClick?.({
      type: 'live_news',
      name: p.name,
      city: p.city,
      country: p.country,
      url: p.url,
      category: p.category,
      embed_allowed: p.embed_allowed !== false && p.embed_allowed !== 'false',
    });
  });
}
