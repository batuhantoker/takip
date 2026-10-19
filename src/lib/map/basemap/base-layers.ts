import type * as maplibregl from 'maplibre-gl';
import { activeLocale } from '@/lib/core/i18n/active';
import { addCctvSource } from '@/lib/feeds/cameras/map-layers';
import { EMERGENCY_ICON } from '@/lib/feeds/aviation/emergency';
import { MAP_INK } from '@/lib/map/style/tokens';
import { readMapPalette } from '@/lib/map/style/palette';
import type { createSatelliteLayer } from '@/lib/feeds/satellites/layer';
import { addTransitLayers } from '@/lib/feeds/transit/map-layers';
import { addAlertLayers } from './bands/alerts';
import { addGroundLayers } from './bands/ground';
import { addWarningIcons, createDot, createIcon } from './bands/icons';
import { addOverlayLayers } from './bands/overlays';
import { EMPTY_FC } from './bands/shared';
import { addSiteLayers } from './bands/sites';
import { localizeBaseLabels } from './label-language';

export function addBaseLayers(map: maplibregl.Map, theme: 'core' | 'ghost', satLayerRef: { current: ReturnType<typeof createSatelliteLayer> | null }) {
  // Theme colors
  const isGhost = theme === 'ghost';
  const phantomPurple = '#B388FF';
  const phantomDark = '#1A0040';
  /* The first paint reads the same `--map-*` properties the recolour
     effects below push in later. Deriving them from `theme` here as well
     is what let the two drift: the effect's ghost palette was four
     distinct violets, this block's was one, and whichever ran last won. */
  const bootStyle = getComputedStyle(document.body);
  const boot = readMapPalette(name => bootStyle.getPropertyValue(name));
  const cameraColor = boot.cctv;
  const flightCom = boot.flightCivil;
  const flightPriv = boot.flightPrivate;
  const flightGov = boot.flightGov;
  const flightMil = boot.flightMilitary;

  // Create icons — TAKIP Unified Palette
  createIcon(map, 'plane-cyan', flightCom, 24);   
  createIcon(map, 'plane-green', flightPriv, 24);   
  createIcon(map, 'plane-pink', flightGov, 24);    
  createIcon(map, 'plane-red', flightMil, 24);     
  createIcon(map, 'plane-grey', boot.flightUnknown, 24);
  createIcon(map, EMERGENCY_ICON, MAP_INK.red, 28);
  createDot(map, 'dot-gold', isGhost ? phantomPurple : '#D4AF37', 8);
  createDot(map, 'dot-red', isGhost ? phantomPurple : '#D32F2F', 10);
  createDot(map, 'dot-orange', isGhost ? phantomPurple : '#E65100', 10);
  createDot(map, 'dot-green', isGhost ? phantomPurple : '#26A69A', 10);
  createDot(map, 'dot-fire', isGhost ? phantomPurple : '#E65100', 10);
  createDot(map, 'dot-cctv', cameraColor, 10);

  addCctvSource(map);
  const sources = ['flights','military','jets','private-fl','fl-emergency','satellites','earthquakes','gdelt','day-night','fires','fire-incidents','fire-perimeters','nhc-forecast','airport-delays','chokepoint-flow','outbreaks','weather','infrastructure','maritime','maritime-choke','maritime-ships','live-news','conflict-zones', 'war-alerts-targets', 'war-alerts-lines', 'balloons', 'launches', 'aurora', 'service-status', 'gnss-interference', 'radiation', 'ip-sweep-devices', 'ip-sweep-pulse', 'ip-sweep-connections', 'scan-targets', 'sdk-entities', 'sdk-links', 'malware-nodes', 'malware-new', 'cyber-heads', 'gdelt-events', 'cf-outages', 'cf-attacks', 'alert-pins', 'wx-points', 'wx-temp-points'];
  sources.forEach(s => map.addSource(s, { type: 'geojson', data: EMPTY_FC }));

  addWarningIcons(map);

  addGroundLayers(map, isGhost, cameraColor);
  addSiteLayers(map, satLayerRef);
  addAlertLayers(map);
  addOverlayLayers(map);

  addTransitLayers(map);
  localizeBaseLabels(map, activeLocale());
}
