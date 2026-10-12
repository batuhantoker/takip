import type * as maplibregl from 'maplibre-gl';
import {
  attackOriginPopupHtml, balloonPopupHtml, c2ServerPopupHtml, chokepointPopupHtml, conflictPopupHtml,
  earthquakePopupHtml, firePopupHtml, gdeltEventPopupHtml, incidentPopupHtml, malwarePopupHtml,
  nuclearPopupHtml, outagePopupHtml, portPopupHtml, radiationPopupHtml, scanTargetPopupHtml,
  sdkLinkPopupHtml, shipPopupHtml, supplierPopupHtml, sweepDevicePopupHtml, weatherEventPopupHtml,
  weatherPointPopupHtml,
} from '@/lib/map-popups';
import type { ShowPopup, WorldMapProps } from './types';

export function bindCctvAndQuakeClicks(map: maplibregl.Map, popup: ShowPopup, onEntityClick: WorldMapProps['onEntityClick']) {
  // ── CCTV (opens CameraViewer panel) ──
  map.on('click', 'cctv-dots', e => {
    if (!e.features?.length) return;
    const p = e.features[0].properties as any;
    const coords = (e.features[0].geometry as any).coordinates;
    // Emit the camera data so the CameraViewer opens
    onEntityClick?.({
      type: 'cctv',
      id: p.id,
      name: p.name,
      city: p.city,
      country: p.country,
      source: p.source,
      feed_url: p.feed_url,
      stream_url: p.stream_url,
      stream_type: p.stream_type,
      external_url: p.external_url,
      lat: coords[1],
      lng: coords[0],
    });
    // Also fly to the camera
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

export function bindFeaturePopups(map: maplibregl.Map, popup: ShowPopup, onEntityClick: WorldMapProps['onEntityClick']) {
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


  // ── OSIRIS SDK link click ──
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
  ['conflict-icons','cctv-dots','eq-circles','fires-heat','gdelt-dots','weather-dots','infra-dots','maritime-dots','choke-dots','news-dots','balloon-dots','rad-dots','ship-dots','ship-arrows','sweep-device-dots','scan-targets-dots','sdk-sea','sdk-sea-glow','sdk-sea-atmo','sdk-air','sdk-air-glow','sdk-air-atmo','sdk-intel','sdk-intel-glow','sdk-intel-atmo','malware-dots','cyber-heads','gdelt-events-dots','cf-outage-dots','cf-attack-dots','alert-pin-dots','wx-wind','wx-temp-label'].forEach(layer => {
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

  // ── Weather grid point (Open-Meteo) ──
  map.on('click', ['wx-wind', 'wx-temp-label'], e => {
    const feature = e.features?.[0];
    if (!feature) return;
    const p = feature.properties as Record<string, unknown>;
    const coords = (feature.geometry as GeoJSON.Point).coordinates;
    popup(coords, weatherPointPopupHtml(p, coords));
  });

  // ── Maritime Ships ──
  map.on('click', ['ship-dots', 'ship-arrows'], e => {
    if (!e.features?.length) return;
    const p = e.features[0].properties as any;
    const coords = (e.features[0].geometry as any).coordinates;
    popup(coords, shipPopupHtml(p, coords));
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
